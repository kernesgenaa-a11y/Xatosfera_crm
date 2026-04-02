import { getApiUrl } from '@/lib/api-url';
import { UserSchema, parseApiObject } from '@/lib/schemas';
import { z } from 'zod';

const API_URL = getApiUrl();
const AuthTokensSchema = z.object({
  access_token: z.string(),
  refresh_token: z.string(),
});
const ErrorPayloadSchema = z.object({
  error: z.string().optional(),
});
const JsonArraySchema = z.array(z.unknown());
const FileUploadResponseSchema = z.object({
  key: z.string(),
});
const UnknownJsonSchema = z.unknown();
const AuthResponseSchema = z.object({
  user: z.unknown().optional(),
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  error: z.string().optional(),
});

function getAccessToken(): string | null {
  return localStorage.getItem('access_token') ?? sessionStorage.getItem('access_token');
}

function getRefreshToken(): string | null {
  return localStorage.getItem('refresh_token') ?? sessionStorage.getItem('refresh_token');
}

function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem('access_token', accessToken);
  localStorage.setItem('refresh_token', refreshToken);
  sessionStorage.setItem('access_token', accessToken);
  sessionStorage.setItem('refresh_token', refreshToken);
}

function clearTokens() {
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  sessionStorage.removeItem('access_token');
  sessionStorage.removeItem('refresh_token');
}

let isRefreshing = false;
let refreshSubscribers: Array<(token: string) => void> = [];

function subscribeTokenRefresh(callback: (token: string) => void) {
  refreshSubscribers.push(callback);
}

function onTokenRefreshed(token: string) {
  refreshSubscribers.forEach((callback) => callback(token));
  refreshSubscribers = [];
}

async function tryRefreshToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  try {
    const response = await fetch(`${API_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    if (!response.ok) {
      clearTokens();
      window.location.href = '/login';
      return null;
    }

    const data = parseApiObject(AuthTokensSchema, await response.json(), 'refresh token');
    if (!data) {
      clearTokens();
      window.location.href = '/login';
      return null;
    }
    setTokens(data.access_token, data.refresh_token);
    return data.access_token;
  } catch {
    clearTokens();
    window.location.href = '/login';
    return null;
  }
}

export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = new Headers(options.headers || {});

  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(url, { ...options, headers });
  if (response.status !== 401) {
    return response;
  }

  if (isRefreshing) {
    return new Promise((resolve) => {
      subscribeTokenRefresh(async (newToken) => {
        headers.set('Authorization', `Bearer ${newToken}`);
        resolve(fetch(url, { ...options, headers }));
      });
    });
  }

  isRefreshing = true;
  const newToken = await tryRefreshToken();
  isRefreshing = false;

  if (!newToken) {
    return response;
  }

  onTokenRefreshed(newToken);
  headers.set('Authorization', `Bearer ${newToken}`);
  return fetch(url, { ...options, headers });
}

async function getRequest(url: string): Promise<{ data: unknown[] | null; error: Error | null }> {
  try {
    const response = await authFetch(url);
    if (!response.ok) {
      const errorPayload = ErrorPayloadSchema.safeParse(
        await response.json().catch(() => ({ error: response.statusText })),
      );
      return {
        data: null,
        error: new Error(
          (errorPayload.success ? errorPayload.data.error : undefined) || `HTTP ${response.status}`,
        ),
      };
    }

    const data = parseApiObject(JsonArraySchema, await response.json(), 'api list response');
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
  }
}

type FilterOperator = 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like';

interface QueryState {
  table: string;
  selectFields: string;
  filters: Array<{ column: string; op: FilterOperator; value: unknown }>;
  orderColumn?: string;
  orderAscending?: boolean;
  limitValue?: number;
  singleRow?: boolean;
}

class QueryBuilder {
  protected state: QueryState;

  constructor(table: string) {
    this.state = { table, selectFields: '*', filters: [] };
  }

  select(fields: string): this {
    this.state.selectFields = fields;
    return this;
  }

  eq(column: string, value: unknown): this {
    this.state.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.state.filters.push({ column, op: 'neq', value });
    return this;
  }

  order(column: string, opts: { ascending: boolean }): this {
    this.state.orderColumn = column;
    this.state.orderAscending = opts.ascending;
    return this;
  }

  limit(count: number): this {
    this.state.limitValue = count;
    return this;
  }

  single(): this {
    this.state.singleRow = true;
    return this;
  }

  protected buildUrl(): string {
    const params = new URLSearchParams();
    params.set('select', this.state.selectFields);

    this.state.filters.forEach(({ column, op, value }) => {
      if (op === 'eq') {
        params.set(column, `eq.${value}`);
      } else if (op === 'neq') {
        params.set(column, `neq.${value}`);
      } else {
        params.set(column, `${op}.${value}`);
      }
    });

    if (this.state.orderColumn) {
      params.set(
        'sort',
        this.state.orderAscending ? this.state.orderColumn : `-${this.state.orderColumn}`,
      );
    }

    if (this.state.limitValue) {
      params.set('limit', String(this.state.limitValue));
    }

    return `${API_URL}/api/${this.state.table}?${params.toString()}`;
  }

  async then(resolve: (value: { data: unknown[] | null; error: Error | null }) => void) {
    const result = await getRequest(this.buildUrl());
    resolve(result);
  }
}

class SingleQueryBuilder extends QueryBuilder {
  async then(resolve: (value: { data: unknown | null; error: Error | null }) => void) {
    const result = await new Promise<{ data: unknown[] | null; error: Error | null }>(
      (innerResolve) => super.then(innerResolve),
    );
    if (result.error) {
      resolve({ data: null, error: result.error });
      return;
    }

    resolve({ data: result.data?.[0] ?? null, error: null });
  }
}

class MutationBuilder {
  private table: string;
  private method: 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  private body?: unknown;
  private filters: Array<{ column: string; value: unknown }> = [];

  constructor(table: string, method: 'POST' | 'PUT' | 'PATCH' | 'DELETE', body?: unknown) {
    this.table = table;
    this.method = method;
    this.body = body;
  }

  eq(column: string, value: unknown): this {
    this.filters.push({ column, value });
    return this;
  }

  async then(resolve: (value: { data: unknown | null; error: Error | null }) => void) {
    try {
      let url = `${API_URL}/api/${this.table}`;
      const idFilter = this.filters.find((filter) => filter.column === 'id');
      if (
        idFilter &&
        (this.method === 'PUT' || this.method === 'PATCH' || this.method === 'DELETE')
      ) {
        url = `${url}/${idFilter.value}`;
      }

      const options: RequestInit = { method: this.method };
      if (this.body && this.method !== 'DELETE') {
        options.body = JSON.stringify(this.body);
      }

      const response = await authFetch(url, options);
      if (!response.ok) {
        const errorPayload = ErrorPayloadSchema.safeParse(
          await response.json().catch(() => ({ error: response.statusText })),
        );
        resolve({
          data: null,
          error: new Error(
            (errorPayload.success ? errorPayload.data.error : undefined) ||
              `HTTP ${response.status}`,
          ),
        });
        return;
      }

      const data = parseApiObject(
        UnknownJsonSchema.nullable(),
        await response.json().catch(() => null),
        'mutation response',
      );
      resolve({ data, error: null });
    } catch (error) {
      resolve({ data: null, error: error instanceof Error ? error : new Error(String(error)) });
    }
  }
}

const storage = {
  from(bucket: string) {
    return {
      async upload(
        _path: string,
        file: File,
      ): Promise<{ data: { path: string } | null; error: Error | null }> {
        try {
          const formData = new FormData();
          formData.append('file', file);
          formData.append('folder', bucket);
          const response = await authFetch(`${API_URL}/api/files/upload`, {
            method: 'POST',
            body: formData,
          });
          if (!response.ok) {
            const errorPayload = ErrorPayloadSchema.safeParse(
              await response.json().catch(() => ({ error: response.statusText })),
            );
            return {
              data: null,
              error: new Error(
                (errorPayload.success ? errorPayload.data.error : undefined) || 'Upload failed',
              ),
            };
          }

          const data = parseApiObject(
            FileUploadResponseSchema,
            await response.json(),
            'file upload',
          );
          if (!data) {
            return { data: null, error: new Error('Upload failed') };
          }
          return { data: { path: data.key }, error: null };
        } catch (error) {
          return { data: null, error: error instanceof Error ? error : new Error(String(error)) };
        }
      },

      async remove(paths: string[]): Promise<{ error: Error | null }> {
        try {
          for (const path of paths) {
            await authFetch(`${API_URL}/api/files/${encodeURIComponent(path)}`, {
              method: 'DELETE',
            });
          }
          return { error: null };
        } catch (error) {
          return { error: error instanceof Error ? error : new Error(String(error)) };
        }
      },

      getPublicUrl(path: string): { data: { publicUrl: string } } {
        return { data: { publicUrl: `${API_URL}/api/files/${encodeURIComponent(path)}` } };
      },
    };
  },
};

export const cloudflareApi = {
  from(table: string) {
    return {
      select(fields = '*') {
        return new QueryBuilder(table).select(fields);
      },
      insert(data: Record<string, unknown>) {
        return new MutationBuilder(table, 'POST', data);
      },
      update(data: Record<string, unknown>) {
        return new MutationBuilder(table, 'PUT', data);
      },
      delete() {
        return new MutationBuilder(table, 'DELETE');
      },
      single() {
        return new SingleQueryBuilder(table);
      },
    };
  },

  storage,

  auth: {
    async signIn(email: string, password: string) {
      const response = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data =
        parseApiObject(AuthResponseSchema, await response.json(), 'sign in response') ?? {};
      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }
      if (data.access_token && data.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
      }
      return {
        data: { user: data.user, session: { access_token: data.access_token } },
        error: null,
      };
    },

    async signUp(email: string, password: string, fullName: string) {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, full_name: fullName }),
      });
      const data =
        parseApiObject(AuthResponseSchema, await response.json(), 'sign up response') ?? {};
      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }
      if (data.access_token && data.refresh_token) {
        setTokens(data.access_token, data.refresh_token);
      }
      return { data: { user: data.user }, error: null };
    },

    async signOut() {
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        await authFetch(`${API_URL}/api/auth/logout`, {
          method: 'POST',
          body: JSON.stringify({ refresh_token: refreshToken }),
        }).catch(() => {});
      }
      clearTokens();
      return { error: null };
    },

    async getUser() {
      const token = getAccessToken();
      if (!token) {
        return { data: { user: null }, error: null };
      }
      const response = await authFetch(`${API_URL}/api/auth/me`);
      if (!response.ok) {
        return { data: { user: null }, error: null };
      }
      const user = parseApiObject(UserSchema, await response.json(), 'current user');
      return { data: { user }, error: null };
    },

    onAuthStateChange(callback: (event: string, session: unknown) => void) {
      const token = getAccessToken();
      if (token) {
        authFetch(`${API_URL}/api/auth/me`)
          .then((response) => {
            if (response.ok) {
              response
                .json()
                .then((data) =>
                  callback('SIGNED_IN', { user: parseApiObject(UserSchema, data, 'current user') }),
                )
                .catch(() => callback('SIGNED_OUT', null));
            } else {
              callback('SIGNED_OUT', null);
            }
          })
          .catch(() => callback('SIGNED_OUT', null));
      } else {
        setTimeout(() => callback('SIGNED_OUT', null), 0);
      }
      return { data: { subscription: { unsubscribe: () => {} } } };
    },
  },
};

export function getFileUrl(key: string | null | undefined): string {
  if (!key) return '';
  if (key.startsWith('http://') || key.startsWith('https://')) return '';
  return `${API_URL}/api/files/${encodeURIComponent(key)}`;
}

export { API_URL };
