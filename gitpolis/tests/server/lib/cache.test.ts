import { describe, expect, it } from 'vitest';
import { TtlCache } from '../../../server/lib/cache';

describe('TtlCache', () => {
  it('returns null for a missing key', () => {
    const cache = new TtlCache<string>(1_000);

    expect(cache.get('missing')).toBeNull();
  });

  it('stores and retrieves a value', () => {
    const cache = new TtlCache<{ name: string }>(1_000);

    cache.set('ada', { name: 'Ada' });

    expect(cache.get('ada')).toEqual({ name: 'Ada' });
  });

  it('expires entries at the TTL boundary', () => {
    const cache = new TtlCache<string>(1_000);
    cache.set('ada', 'lovelace', 0);

    expect(cache.get('ada', 999)).toBe('lovelace');
    expect(cache.get('ada', 1_000)).toBeNull();
  });

  it('removes expired entries instead of leaking them', () => {
    const cache = new TtlCache<string>(100);
    cache.set('a', '1', 0);
    cache.set('b', '2', 0);

    expect(cache.get('a', 200)).toBeNull();
    // The expired entry is gone, so a fresh set does not evict an unrelated key.
    cache.set('c', '3', 300);

    expect(cache.get('b', 350)).toBeNull();
    expect(cache.get('c', 350)).toBe('3');
  });

  it('evicts the oldest insertion when at capacity', () => {
    const cache = new TtlCache<string>(60_000, 2);
    cache.set('first', '1');
    cache.set('second', '2');
    cache.set('third', '3');

    expect(cache.get('first')).toBeNull();
    expect(cache.get('second')).toBe('2');
    expect(cache.get('third')).toBe('3');
  });

  it('keeps accepting new keys after eviction', () => {
    const cache = new TtlCache<number>(60_000, 1);

    for (let i = 0; i < 10; i++) cache.set(`key-${i}`, i);

    expect(cache.get('key-9')).toBe(9);
    expect(cache.get('key-8')).toBeNull();
  });

  it('treats values without coercion', () => {
    const zero = new TtlCache<number>(1_000);
    zero.set('zero', 0);

    expect(zero.get('zero')).toBe(0);
  });
});
