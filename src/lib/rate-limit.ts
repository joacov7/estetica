import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Rate limiting with graceful degradation.
 *
 * If UPSTASH_REDIS_REST_URL/TOKEN are set, limits are enforced in a shared
 * Redis store (sliding window) — correct across serverless instances. If not,
 * it falls back to an in-memory limiter (per instance): a basic layer only.
 * Same interface either way, so call sites don't change.
 */
export interface RateLimiter {
  check(key: string): Promise<{ ok: boolean; retryAfterMs: number }>;
}

class MemoryRateLimiter implements RateLimiter {
  private hits = new Map<string, { count: number; resetAt: number }>();
  constructor(private limit: number, private windowMs: number) {}
  async check(key: string) {
    const now = Date.now();
    const entry = this.hits.get(key);
    if (!entry || now >= entry.resetAt) {
      this.hits.set(key, { count: 1, resetAt: now + this.windowMs });
      if (this.hits.size > 5000) for (const [k, v] of this.hits) if (now >= v.resetAt) this.hits.delete(k);
      return { ok: true, retryAfterMs: 0 };
    }
    if (entry.count >= this.limit) return { ok: false, retryAfterMs: entry.resetAt - now };
    entry.count += 1;
    return { ok: true, retryAfterMs: 0 };
  }
}

class UpstashRateLimiter implements RateLimiter {
  private rl: Ratelimit;
  constructor(redis: Redis, limit: number, windowSeconds: number, prefix: string) {
    this.rl = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSeconds} s`),
      prefix: `rl:${prefix}`,
      analytics: false,
    });
  }
  async check(key: string) {
    const r = await this.rl.limit(key);
    return { ok: r.success, retryAfterMs: Math.max(0, r.reset - Date.now()) };
  }
}

const MIN = 60 * 1000;
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN ? Redis.fromEnv() : null;

/** Distributed limiter if Redis is configured, else in-memory. */
function makeLimiter(limit: number, windowMs: number, prefix: string): RateLimiter {
  return redis
    ? new UpstashRateLimiter(redis, limit, Math.round(windowMs / 1000), prefix)
    : new MemoryRateLimiter(limit, windowMs);
}

export const isRedisRateLimiting = redis !== null;

/** Public booking: 5 attempts / 10 min per IP+phone. */
export const bookingLimiter = makeLimiter(5, 10 * MIN, "booking");
/** Login: 10 attempts / 10 min per IP — blunts credential brute force. */
export const loginLimiter = makeLimiter(10, 10 * MIN, "login");
/** Signup: 5 new accounts / hour per IP. */
export const signupLimiter = makeLimiter(5, 60 * MIN, "signup");
/** Availability lookups: 60 / 5 min per IP. */
export const availabilityLimiter = makeLimiter(60, 5 * MIN, "avail");

/** Best-effort client IP from proxy headers. */
export function clientIp(headers: Headers): string {
  return headers.get("x-forwarded-for")?.split(",")[0]?.trim() || headers.get("x-real-ip") || "unknown";
}
