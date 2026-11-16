import { describe, expect, it } from 'vitest';
import { FixedWindowRateLimiter } from '../../../server/lib/rateLimit';

describe('FixedWindowRateLimiter', () => {
  it('allows requests up to the limit', () => {
    const limiter = new FixedWindowRateLimiter(3, 60_000);

    expect(limiter.check('ip', 0)).toEqual({ allowed: true, remaining: 2, retryAfterSeconds: 0 });
    expect(limiter.check('ip', 0)).toEqual({ allowed: true, remaining: 1, retryAfterSeconds: 0 });
    expect(limiter.check('ip', 0)).toEqual({ allowed: true, remaining: 0, retryAfterSeconds: 0 });
  });

  it('denies the request after the limit with a retry hint', () => {
    const limiter = new FixedWindowRateLimiter(2, 10_000);
    limiter.check('ip', 1_000);
    limiter.check('ip', 1_000);

    expect(limiter.check('ip', 3_000)).toEqual({
      allowed: false,
      remaining: 0,
      retryAfterSeconds: 8,
    });
  });

  it('rounds the retry hint up to at least one second', () => {
    const limiter = new FixedWindowRateLimiter(1, 10_000);
    limiter.check('ip', 0);

    expect(limiter.check('ip', 9_999).retryAfterSeconds).toBe(1);
  });

  it('opens a new window when the old one expires', () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);
    limiter.check('ip', 0);
    expect(limiter.check('ip', 500).allowed).toBe(false);

    expect(limiter.check('ip', 1_000)).toEqual({
      allowed: true,
      remaining: 0,
      retryAfterSeconds: 0,
    });
  });

  it('tracks keys independently', () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);
    limiter.check('a', 0);

    expect(limiter.check('a', 0).allowed).toBe(false);
    expect(limiter.check('b', 0).allowed).toBe(true);
  });

  it('evicts the oldest key when the key cap is reached', () => {
    const limiter = new FixedWindowRateLimiter(5, 60_000, 2);
    limiter.check('a', 0);
    limiter.check('b', 0);

    // Adding a third key must not grow the map without bound.
    expect(limiter.check('c', 0).allowed).toBe(true);
    // 'a' was evicted, so its window restarts with a full budget.
    expect(limiter.check('a', 0)).toEqual({
      allowed: true,
      remaining: 4,
      retryAfterSeconds: 0,
    });
  });

  it('prunes expired buckets once the map is large', () => {
    const limiter = new FixedWindowRateLimiter(2, 1_000, 5_000);

    for (let i = 0; i < 600; i++) limiter.check(`key-${i}`, 0);
    // Every earlier bucket has expired; pruning must free them so new keys fit.
    for (let i = 600; i < 1_200; i++) {
      expect(limiter.check(`key-${i}`, 10_000).allowed).toBe(true);
    }
    expect(limiter.check('key-0', 10_000).allowed).toBe(true);
  });

  it('counts a rejected request without extending the window', () => {
    const limiter = new FixedWindowRateLimiter(1, 1_000);
    limiter.check('ip', 0);
    limiter.check('ip', 400);

    expect(limiter.check('ip', 999).allowed).toBe(false);
    expect(limiter.check('ip', 1_000).allowed).toBe(true);
  });
});
