import "server-only";

/**
 * Minimal fixed-window rate limiter.
 *
 * In-memory by default (per server instance) — a basic layer against casual
 * abuse and brute force. NOTE: on serverless (Vercel) each instance keeps its
 * own map and instances are ephemeral, so a determined attacker hitting many
 * instances can dilute the limit. For production-grade protection back this
 * with a shared store (e.g. Upstash Redis) — the interface stays the same.
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
      // opportunistic cleanup to bound memory
      if (this.hits.size > 5000) {
        for (const [k, v] of this.hits) if (now >= v.resetAt) this.hits.delete(k);
      }
      return { ok: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.limit) {
      return { ok: false, retryAfterMs: entry.resetAt - now };
    }
    entry.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
}

const MIN = 60 * 1000;

/** Public booking: 5 attempts / 10 min per IP+phone. */
export const bookingLimiter: RateLimiter = new MemoryRateLimiter(5, 10 * MIN);
/** Login: 10 attempts / 10 min per IP — blunts credential brute force. */
export const loginLimiter: RateLimiter = new MemoryRateLimiter(10, 10 * MIN);
/** Signup: 5 new accounts / hour per IP. */
export const signupLimiter: RateLimiter = new MemoryRateLimiter(5, 60 * MIN);
/** Availability lookups: 60 / 5 min per IP. */
export const availabilityLimiter: RateLimiter = new MemoryRateLimiter(60, 5 * MIN);

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
