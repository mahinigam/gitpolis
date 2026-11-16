interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

/**
 * Tiny in-process fixed-window rate limiter.
 *
 * Adequate for the dev/preview server this app ships with. A real deployment
 * should use a shared store (Redis, Cloudflare KV/Durable Objects) because
 * this state is per-process and resets on restart.
 */
export class FixedWindowRateLimiter {
  private readonly buckets = new Map<string, Bucket>();

  constructor(
    private readonly maxRequests: number,
    private readonly windowMs: number,
    /** Hard cap so spoofed keys cannot grow the map without bound. */
    private readonly maxKeys = 10_000
  ) {}

  check(key: string, now = Date.now()): RateLimitResult {
    this.prune(now);

    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (this.buckets.size >= this.maxKeys) this.evictOldest();
      this.buckets.set(key, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true, remaining: this.maxRequests - 1, retryAfterSeconds: 0 };
    }

    if (bucket.count >= this.maxRequests) {
      return {
        allowed: false,
        remaining: 0,
        retryAfterSeconds: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
      };
    }

    bucket.count += 1;
    return {
      allowed: true,
      remaining: this.maxRequests - bucket.count,
      retryAfterSeconds: 0,
    };
  }

  private prune(now: number): void {
    if (this.buckets.size < 512) return;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }

  /** Drops the oldest insertion-order bucket. */
  private evictOldest(): void {
    const oldest = this.buckets.keys().next().value;
    if (oldest !== undefined) this.buckets.delete(oldest);
  }
}
