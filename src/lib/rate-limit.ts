import "server-only";

/**
 * Minimal fixed-window rate limiter.
 *
 * In-memory by default (per server instance) — good enough to blunt casual
 * abuse of the public booking endpoint in the MVP. The interface is kept tiny
 * so it can be swapped for a shared store (Upstash/Redis) without touching
 * call sites.
 */
export interface RateLimiter {
  check(key: string): Promise<{ ok: boolean; retryAfterMs: number }>;
}

class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();

  constructor(
    private limit: number,
    private windowMs: number,
  ) {}

  async check(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      return { ok: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.limit) {
      return { ok: false, retryAfterMs: entry.resetAt - now };
    }
    entry.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
}

/** Public booking limiter: 5 attempts per 10 minutes per key. */
export const bookingLimiter: RateLimiter = new MemoryRateLimiter(5, 10 * 60 * 1000);
