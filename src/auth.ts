import type { AuthResult, Env, UserRecord } from './types';
import { checkRateLimit, clearRateLimit } from './middleware/rate-limiter';
import {
  errorResponse,
  extractToken,
  isRecord,
  jsonResponse,
  parseBody,
  sanitizeUser,
} from './utils';

export const ACCESS_TOKEN_EXPIRY = 60 * 60 * 8;
export const REFRESH_TOKEN_EXPIRY = 60 * 60 * 24 * 30;
export const USER_AUTH_COLUMNS =
  'id, email, password_hash, full_name, role, phone, avatar_url, approved, approved_at, approved_by, is_active, created_at, updated_at';
const LOGIN_ENDPOINT = '/api/auth/login';
const REGISTER_ENDPOINT = '/api/auth/register';

export function generateId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashArray = new Uint8Array(derivedBits);
  const saltHex = Array.from(salt)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  const hashHex = Array.from(hashArray)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return `${saltHex}:${hashHex}`;
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [saltHex, hashHex] = storedHash.split(':');
  if (!saltHex || !hashHex) return false;
  const salt = new Uint8Array(saltHex.match(/.{2}/g)?.map((byte) => parseInt(byte, 16)) ?? []);
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const derivedBits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const newHashHex = Array.from(new Uint8Array(derivedBits))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
  return newHashHex === hashHex;
}

function base64UrlEncode(data: Uint8Array): string {
  const base64 = btoa(String.fromCharCode(...data));
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}

function base64UrlDecode(value: string): Uint8Array {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const decoded = atob(base64 + padding);
  return new Uint8Array([...decoded].map((char) => char.charCodeAt(0)));
}

export async function createJWT(
  payload: Record<string, unknown>,
  secret: string,
  expiresIn = 3600,
): Promise<string> {
  const encoder = new TextEncoder();
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const fullPayload = { ...payload, iat: now, exp: now + expiresIn };
  const headerB64 = base64UrlEncode(encoder.encode(JSON.stringify(header)));
  const payloadB64 = base64UrlEncode(encoder.encode(JSON.stringify(fullPayload)));
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign(
    'HMAC',
    key,
    encoder.encode(`${headerB64}.${payloadB64}`),
  );
  return `${headerB64}.${payloadB64}.${base64UrlEncode(new Uint8Array(signature))}`;
}

export async function verifyJWT(
  token: string,
  secret: string,
): Promise<Record<string, unknown> | null> {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signatureB64] = parts;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify'],
    );
    const signature = base64UrlDecode(signatureB64) as unknown as BufferSource;
    const valid = await crypto.subtle.verify(
      'HMAC',
      key,
      signature,
      encoder.encode(`${headerB64}.${payloadB64}`),
    );
    if (!valid) return null;
    const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(payloadB64)));
    if (
      !isRecord(payload) ||
      typeof payload.exp !== 'number' ||
      payload.exp < Math.floor(Date.now() / 1000)
    )
      return null;
    return payload;
  } catch {
    return null;
  }
}

export function generateRefreshToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

export async function getUserById(
  env: Env,
  userId: string,
  columns = USER_AUTH_COLUMNS,
): Promise<UserRecord | null> {
  return (
    (await env.DB.prepare(`SELECT ${columns} FROM users WHERE id = ?`)
      .bind(userId)
      .first<UserRecord>()) ?? null
  );
}

export async function handleRegister(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response> {
  const rateLimit = await checkRateLimit(request, env, {
    endpoint: REGISTER_ENDPOINT,
    limit: 3,
    windowSeconds: 60 * 60,
  });
  if (!rateLimit.allowed) {
    const response = errorResponse('Too Many Requests', 429, env, request);
    response.headers.set('Retry-After', String(rateLimit.retryAfter));
    return response;
  }
  const body = await parseBody(request);
  if (
    !body ||
    typeof body.email !== 'string' ||
    typeof body.password !== 'string' ||
    typeof body.full_name !== 'string'
  ) {
    return errorResponse('Missing required fields', 400, env, request);
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(body.email)) return errorResponse('Invalid email format', 400, env, request);
  if (body.password.length < 8)
    return errorResponse('Password must be at least 8 characters', 400, env, request);
  if (body.email.length > 254) return errorResponse('Email too long', 400, env, request);
  if (body.full_name.length > 200) return errorResponse('Name too long', 400, env, request);
  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?')
    .bind(body.email)
    .first();
  if (existing) return errorResponse('User already exists', 409, env, request);
  const id = generateId();
  const passwordHash = await hashPassword(body.password);
  await env.DB.prepare(
    "INSERT INTO users (id, email, password_hash, full_name, role, approved, created_at, updated_at) VALUES (?, ?, ?, ?, 'manager', 0, datetime('now'), datetime('now'))",
  )
    .bind(id, body.email, passwordHash, body.full_name)
    .run();
  const user: UserRecord = {
    id,
    email: body.email,
    password_hash: passwordHash,
    full_name: body.full_name,
    role: 'manager',
    phone: null,
    avatar_url: null,
    approved: 0,
    approved_at: null,
    approved_by: null,
    is_active: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  const accessToken = await createJWT(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    ACCESS_TOKEN_EXPIRY,
  );
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
  )
    .bind(sessionId, user.id, refreshToken, expiresAt)
    .run();
  return jsonResponse(
    { user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken },
    201,
    env,
    request,
  );
}

export async function handleLogin(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response> {
  const rateLimit = await checkRateLimit(request, env, {
    endpoint: LOGIN_ENDPOINT,
    limit: 5,
    windowSeconds: 15 * 60,
  });
  if (!rateLimit.allowed) {
    const response = errorResponse('Too Many Requests', 429, env, request);
    response.headers.set('Retry-After', String(rateLimit.retryAfter));
    return response;
  }
  const body = await parseBody(request);
  if (!body || typeof body.email !== 'string' || typeof body.password !== 'string') {
    return errorResponse('Missing email or password', 400, env, request);
  }
  const user = await env.DB.prepare(`SELECT ${USER_AUTH_COLUMNS} FROM users WHERE email = ?`)
    .bind(body.email)
    .first<UserRecord>();
  if (!user || !user.password_hash) return errorResponse('Invalid credentials', 401, env, request);
  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) return errorResponse('Invalid credentials', 401, env, request);
  const accessToken = await createJWT(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    ACCESS_TOKEN_EXPIRY,
  );
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
  )
    .bind(sessionId, user.id, refreshToken, expiresAt)
    .run();
  await clearRateLimit(request, env, LOGIN_ENDPOINT);
  return jsonResponse(
    { user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken },
    200,
    env,
    request,
  );
}

export async function handleRefresh(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response> {
  const body = await parseBody(request);
  if (!body || typeof body.refresh_token !== 'string')
    return errorResponse('Missing refresh token', 400, env, request);
  const session = await env.DB.prepare(
    `SELECT s.user_id, ${USER_AUTH_COLUMNS}
     FROM sessions s
     JOIN users u ON s.user_id = u.id
     WHERE s.refresh_token = ? AND s.expires_at > datetime('now')`,
  )
    .bind(body.refresh_token)
    .first<UserRecord & { user_id: string }>();
  if (!session) return errorResponse('Invalid or expired refresh token', 401, env, request);
  await env.DB.prepare('DELETE FROM sessions WHERE refresh_token = ?')
    .bind(body.refresh_token)
    .run();
  const user: UserRecord = { ...session, id: session.user_id };
  const accessToken = await createJWT(
    { sub: user.id, email: user.email, role: user.role },
    jwtSecret,
    ACCESS_TOKEN_EXPIRY,
  );
  const refreshToken = generateRefreshToken();
  const sessionId = generateId();
  const expiresAt = new Date(Date.now() + REFRESH_TOKEN_EXPIRY * 1000).toISOString();
  await env.DB.prepare(
    "INSERT INTO sessions (id, user_id, refresh_token, expires_at, created_at) VALUES (?, ?, ?, ?, datetime('now'))",
  )
    .bind(sessionId, user.id, refreshToken, expiresAt)
    .run();
  return jsonResponse(
    { user: sanitizeUser(user), access_token: accessToken, refresh_token: refreshToken },
    200,
    env,
    request,
  );
}

export async function handleLogout(request: Request, env: Env): Promise<Response> {
  const body = await parseBody(request);
  if (body && typeof body.refresh_token === 'string') {
    await env.DB.prepare('DELETE FROM sessions WHERE refresh_token = ?')
      .bind(body.refresh_token)
      .run();
  }
  return jsonResponse({ success: true }, 200, env, request);
}

export async function handleGetMe(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<Response> {
  const token = extractToken(request);
  if (!token) return errorResponse('No token provided', 401, env, request);
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload || typeof payload.sub !== 'string')
    return errorResponse('Invalid token', 401, env, request);
  const user = await getUserById(env, payload.sub);
  if (!user) return errorResponse('User not found', 404, env, request);
  return jsonResponse(sanitizeUser(user), 200, env, request);
}

export async function verifyAuth(
  request: Request,
  env: Env,
  jwtSecret: string,
): Promise<AuthResult> {
  const token = extractToken(request);
  if (!token) return { success: false };
  const payload = await verifyJWT(token, jwtSecret);
  if (!payload || typeof payload.sub !== 'string') return { success: false };
  const user = await getUserById(env, payload.sub);
  if (!user) return { success: false };
  return { success: true, user };
}

export async function handleAuthRoute(
  request: Request,
  env: Env,
  path: string,
  method: string,
  jwtSecret: string,
): Promise<Response | null> {
  if (path === '/api/auth/register' && method === 'POST')
    return handleRegister(request, env, jwtSecret);
  if (path === '/api/auth/login' && method === 'POST') return handleLogin(request, env, jwtSecret);
  if (path === '/api/auth/refresh' && method === 'POST')
    return handleRefresh(request, env, jwtSecret);
  if (path === '/api/auth/logout' && method === 'POST') return handleLogout(request, env);
  if (path === '/api/auth/me' && method === 'GET') return handleGetMe(request, env, jwtSecret);
  return null;
}
