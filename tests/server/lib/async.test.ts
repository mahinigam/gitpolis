import { describe, expect, it, vi } from 'vitest';
import { mapWithConcurrency, sleep } from '../../../server/lib/async';

describe('mapWithConcurrency', () => {
  it('returns an empty array without calling the mapper', async () => {
    const mapper = vi.fn();

    await expect(mapWithConcurrency([], 4, mapper)).resolves.toEqual([]);
    expect(mapper).not.toHaveBeenCalled();
  });

  it('preserves input order even when work completes out of order', async () => {
    const delays = [30, 5, 20, 1];

    const result = await mapWithConcurrency(delays, 4, async (delay) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return delay * 2;
    });

    expect(result).toEqual([60, 10, 40, 2]);
  });

  it('passes the item and its index to the mapper', async () => {
    const mapper = vi.fn(async (item: string, index: number) => `${index}:${item}`);

    await expect(mapWithConcurrency(['a', 'b'], 2, mapper)).resolves.toEqual(['0:a', '1:b']);
    expect(mapper).toHaveBeenNthCalledWith(1, 'a', 0);
    expect(mapper).toHaveBeenNthCalledWith(2, 'b', 1);
  });

  it.each([
    [0, 1],
    [-2, 1],
    [99, 3],
  ])('clamps concurrency %j to %j for three items', async (concurrency, expected) => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(Array.from({ length: 3 }, (_, i) => i), concurrency, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return null;
    });

    expect(maxInFlight).toBe(expected);
  });

  it('never exceeds the requested concurrency', async () => {
    let inFlight = 0;
    let maxInFlight = 0;

    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 3, async () => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return null;
    });

    expect(maxInFlight).toBe(3);
  });

  it('propagates the first rejection', async () => {
    const run = mapWithConcurrency([1, 2, 3], 2, async (item) => {
      if (item === 2) throw new Error('boom');
      return item;
    });

    await expect(run).rejects.toThrow('boom');
  });
});

describe('sleep', () => {
  it('resolves after the requested delay', async () => {
    vi.useFakeTimers();
    try {
      let settled = false;
      const promise = sleep(50).then(() => {
        settled = true;
      });

      await vi.advanceTimersByTimeAsync(49);
      expect(settled).toBe(false);

      await vi.advanceTimersByTimeAsync(1);
      await promise;
      expect(settled).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('resolves immediately for a zero delay', async () => {
    await expect(sleep(0)).resolves.toBeUndefined();
  });
});
