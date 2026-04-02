export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  first<T = Record<string, unknown>>(): Promise<T | null>;
  run(): Promise<unknown>;
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement;
}

export interface R2ObjectBodyLike {
  body: ReadableStream | null;
  httpEtag: string;
  httpMetadata?: {
    contentType?: string;
  };
  writeHttpMetadata(headers: Headers): void;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export interface R2BucketLike {
  get(key: string): Promise<R2ObjectBodyLike | null>;
  put(
    key: string,
    value: ReadableStream | ArrayBuffer | ArrayBufferView | string | Blob,
    options?: { httpMetadata?: { contentType?: string } },
  ): Promise<void>;
}

export interface ImagesTransformResultLike {
  response(): Response;
}

export interface ImagesBindingLike {
  input(stream: ReadableStream): {
    output(options: { format: string; quality?: number }): Promise<ImagesTransformResultLike>;
  };
}

export interface Env {
  DB: D1DatabaseLike;
  R2: R2BucketLike;
  IMAGES?: ImagesBindingLike;
  IMAGES_QUEUE?: {
    send(message: unknown): Promise<void>;
  };
  BROWSER?: unknown;
  JWT_SECRET?: string;
  CORS_ORIGIN?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  [key: string]: unknown;
}

export interface UserRecord {
  id: string;
  email: string;
  password_hash?: string;
  full_name: string;
  role: string;
  phone?: string | null;
  avatar_url?: string | null;
  approved?: number | boolean | null;
  approved_at?: string | null;
  approved_by?: string | null;
  is_active?: number | boolean | null;
  created_at?: string;
  updated_at?: string;
  [key: string]: unknown;
}

export interface Property {
  id: string;
  title: string;
  price?: number | null;
  currency?: string | null;
  price_usd?: number | null;
  status?: string;
  manager_id?: string | null;
  created_by?: string | null;
  updated_at?: string;
}

export interface Client {
  id: string;
  full_name: string;
  budget?: number | null;
  currency?: string | null;
  budget_max_usd?: number | null;
  manager_id?: string | null;
  updated_at?: string;
}

export interface Deal {
  id: string;
  title: string;
  stage?: string;
  assigned_agent_id?: string | null;
  created_by?: string | null;
  updated_at?: string;
}

export interface LegacyWorkerModule {
  fetch(request: Request, env: Env): Promise<Response>;
}

export interface AuthResult {
  success: boolean;
  user?: UserRecord;
}
