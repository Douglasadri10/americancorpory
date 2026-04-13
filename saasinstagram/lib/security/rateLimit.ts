/**
 * In-memory sliding-window rate limiter.
 * Works per Vercel function instance — good enough for abuse prevention.
 * For distributed rate limiting across instances, swap for @upstash/ratelimit + Redis.
 */

interface WindowEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, WindowEntry>();

// Prune expired entries every 5 minutes to avoid memory leaks
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt < now) store.delete(key);
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitConfig {
  /** Max requests allowed in the window */
  limit: number;
  /** Window duration in seconds */
  windowSec: number;
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetAt: number; // Unix ms
}

export function checkRateLimit(key: string, config: RateLimitConfig): RateLimitResult {
  const now = Date.now();
  const windowMs = config.windowSec * 1000;

  let entry = store.get(key);

  if (!entry || entry.resetAt <= now) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { success: true, limit: config.limit, remaining: config.limit - 1, resetAt: entry.resetAt };
  }

  entry.count++;
  store.set(key, entry);

  const remaining = Math.max(0, config.limit - entry.count);
  return {
    success: entry.count <= config.limit,
    limit: config.limit,
    remaining,
    resetAt: entry.resetAt,
  };
}

/** Extract best available IP from request headers (Vercel-aware) */
export function getClientIp(request: Request): string {
  const headers = request instanceof Request ? request.headers : (request as { headers: Headers }).headers;
  return (
    headers.get('x-real-ip') ??
    headers.get('cf-connecting-ip') ??
    headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    'unknown'
  );
}

// ─── Preset configs ────────────────────────────────────────────────────────

/** Strict: auth endpoints (login, register, token exchange) */
export const AUTH_RATE_LIMIT: RateLimitConfig = { limit: 10, windowSec: 60 };

/** Standard: general API routes */
export const API_RATE_LIMIT: RateLimitConfig = { limit: 60, windowSec: 60 };

/** Relaxed: read-heavy public endpoints */
export const READ_RATE_LIMIT: RateLimitConfig = { limit: 120, windowSec: 60 };

/** Tight: AI-powered / expensive endpoints */
export const AI_RATE_LIMIT: RateLimitConfig = { limit: 20, windowSec: 60 };

/** Webhook: high volume, per-IP (Meta sends from many IPs) */
export const WEBHOOK_RATE_LIMIT: RateLimitConfig = { limit: 300, windowSec: 60 };
