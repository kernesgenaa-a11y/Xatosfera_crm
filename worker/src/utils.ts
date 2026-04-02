import type { Env, UserRecord } from './types';

export const DEFAULT_ORDER = 'ORDER BY created_at DESC';

export interface PaginationParams {
  limit: number | null;
  cursor: string | null;
}

export interface DecodedCursor {
  createdAt: string;
  id: string;
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getAllowedOrigin(request: Request, env: Env): string {
  const origin = request.headers.get('Origin') || '';
  if (!env.CORS_ORIGIN || env.CORS_ORIGIN === '*') return '*';
  if (origin === env.CORS_ORIGIN) return origin;
  if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
  if (/^https:\/\/[^.]+\.pages\.dev$/.test(origin)) return origin;
  if (origin === 'https://hatosfera-crm.pp.ua') return origin;
  if (origin === 'https://hatosfera.business') return origin;
  if (/^https:\/\/[^.]+\.app\.github\.dev$/.test(origin)) return origin;
  if (/^https:\/\/[^.]+\.preview\.app\.github\.dev$/.test(origin)) return origin;
  return String(env.CORS_ORIGIN);
}

export function corsHeaders(env: Env, request: Request): Record<string, string> {
  const origin = getAllowedOrigin(request, env);
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
    'Access-Control-Max-Age': '86400',
  };
}

export function jsonResponse(data: unknown, status: number, env: Env, request: Request): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env, request) },
  });
}

export function errorResponse(
  message: string,
  status: number,
  env: Env,
  request: Request,
): Response {
  return jsonResponse({ error: message }, status, env, request);
}

export function handleOptions(request: Request, env: Env): Response {
  return new Response(null, { status: 204, headers: corsHeaders(env, request) });
}

export async function parseBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return isRecord(body) ? body : null;
  } catch {
    return null;
  }
}

export function extractToken(request: Request): string | null {
  const auth = request.headers.get('Authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7);

  const url = new URL(request.url);
  if (!url.pathname.startsWith('/api/files/')) return null;

  // Accepted tradeoff: Short-lived JWT tokens (8-hour expiry) are passed via query parameter
  // for /api/files/* endpoints to enable direct URL usage in img tags and download links.
  // This is documented externally and tokens are NOT logged to prevent exposure in logs.
  const token = url.searchParams.get('token');
  return token || null;
}

export function parseQuery(url: URL): Record<string, string> {
  const params: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

export function parseJsonArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value !== 'string' || !value.trim()) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed)
      ? parsed.filter((item): item is string => typeof item === 'string')
      : [];
  } catch {
    return [];
  }
}

export function buildOrderClause(sort: string | null | undefined): string {
  if (!sort) return DEFAULT_ORDER;
  const isDesc = sort.startsWith('-');
  const column = sort.replace(/^-/, '');
  const direction = isDesc ? 'DESC' : 'ASC';
  const allowedColumns = [
    'created_at',
    'updated_at',
    'title',
    'full_name',
    'email',
    'price',
    'status',
    'stage',
    'starts_at',
  ];
  if (!allowedColumns.includes(column)) return DEFAULT_ORDER;
  return `ORDER BY ${column} ${direction}`;
}

export function parsePagination(url: URL): PaginationParams {
  const rawLimit = Number(url.searchParams.get('limit'));
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : null;
  const cursor = url.searchParams.get('cursor');
  return { limit, cursor };
}

export function decodeCursor(cursor: string | null | undefined): DecodedCursor | null {
  if (!cursor || !cursor.includes('::')) return null;
  const separatorIndex = cursor.indexOf('::');
  const createdAt = cursor.slice(0, separatorIndex);
  const id = cursor.slice(separatorIndex + 2);
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

export function encodeCursor(
  row: { created_at?: string; id?: string } | null | undefined,
): string | null {
  if (!row?.created_at || !row?.id) return null;
  return `${row.created_at}::${row.id}`;
}

export function buildPaginatedPayload<T extends { created_at?: string; id?: string }>(
  rows: T[],
  limit: number | null,
): T[] | { data: T[]; hasMore: boolean; nextCursor: string | null } {
  if (!limit) return rows;
  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return {
    data,
    hasMore,
    nextCursor: hasMore ? encodeCursor(data[data.length - 1]) : null,
  };
}

export function sanitizeUser<T extends UserRecord>(user: T): Omit<T, 'password_hash'> {
  const { password_hash: _passwordHash, ...safeUser } = user;
  return safeUser;
}

export function sanitizeUrlForLogging(url: string | URL): string {
  const urlObj = typeof url === 'string' ? new URL(url) : url;
  if (urlObj.searchParams.has('token')) {
    const sanitized = new URL(urlObj.toString());
    sanitized.searchParams.set('token', '<redacted>');
    return sanitized.toString();
  }
  return urlObj.toString();
}
