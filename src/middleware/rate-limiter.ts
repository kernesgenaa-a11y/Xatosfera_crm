import type { Env } from '../types';

export interface RateLimitConfig {
  endpoint: string;
  limit: number;
  windowSeconds: number;
}

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number;
}

let rateLimitTableReady = false;

function getClientIp(request: Request): string {
  const cfIp = request.headers.get('CF-Connecting-IP');
  if (cfIp) return cfIp;
  const forwardedFor = request.headers.get('X-Forwarded-For');
  if (forwardedFor) return forwardedFor.split(',')[0]?.trim() || 'unknown';
  return 'unknown';
}

function getRateLimitKey(request: Request, endpoint: string): string {
  return `rate:${getClientIp(request)}:${endpoint}`;
}

async function ensureRateLimitTable(env: Env): Promise<void> {
  if (rateLimitTableReady) return;
  await env.DB.prepare(
    'CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, window_start INTEGER NOT NULL)',
  ).run();
  rateLimitTableReady = true;
}

export async function checkRateLimit(
  request: Request,
  env: Env,
  config: RateLimitConfig,
): Promise<RateLimitResult> {
  await ensureRateLimitTable(env);
  const key = getRateLimitKey(request, config.endpoint);
  const now = Math.floor(Date.now() / 1000);
  const row = await env.DB.prepare('SELECT count, window_start FROM rate_limits WHERE key = ?')
    .bind(key)
    .first<{ count: number; window_start: number }>();

  if (!row || now - row.window_start >= config.windowSeconds) {
    await env.DB.prepare(
      'INSERT INTO rate_limits (key, count, window_start) VALUES (?, 1, ?) ON CONFLICT(key) DO UPDATE SET count = 1, window_start = excluded.window_start',
    )
      .bind(key, now)
      .run();
    return { allowed: true, retryAfter: 0 };
  }

  if (row.count >= config.limit) {
    return {
      allowed: false,
      retryAfter: Math.max(1, config.windowSeconds - (now - row.window_start)),
    };
  }

  await env.DB.prepare('UPDATE rate_limits SET count = count + 1 WHERE key = ?').bind(key).run();
  return { allowed: true, retryAfter: 0 };
}

export async function clearRateLimit(request: Request, env: Env, endpoint: string): Promise<void> {
  await ensureRateLimitTable(env);
  const key = getRateLimitKey(request, endpoint);
  await env.DB.prepare('DELETE FROM rate_limits WHERE key = ?').bind(key).run();
}
