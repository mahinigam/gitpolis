import { describe, expect, it } from 'vitest';
import { hashString, SeededRNG } from '../../src/domain/prng';

describe('hashString', () => {
  it('is deterministic for the same input', () => {
    expect(hashString('gitpolis')).toBe(hashString('gitpolis'));
  });

  it('returns an unsigned 32-bit integer', () => {
    for (const input of ['', 'a', 'torvalds', 'ünïcødé', 'x'.repeat(500)]) {
      const value = hashString(input);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(2 ** 32);
    }
  });

  it('separates inputs that differ by one character', () => {
    expect(hashString('repo-a')).not.toBe(hashString('repo-b'));
  });
});

describe('SeededRNG', () => {
  it('produces identical sequences for identical seeds', () => {
    const a = new SeededRNG(1234);
    const b = new SeededRNG(1234);
    const first = Array.from({ length: 20 }, () => a.next());
    const second = Array.from({ length: 20 }, () => b.next());
    expect(first).toEqual(second);
  });

  it('produces different sequences for different seeds', () => {
    const a = new SeededRNG(1);
    const b = new SeededRNG(2);
    expect(a.next()).not.toBe(b.next());
  });

  it('stays within [0, 1)', () => {
    const rng = new SeededRNG(42);
    for (let i = 0; i < 1000; i++) {
      const value = rng.next();
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThan(1);
    }
  });

  it('treats a zero seed as non-zero state', () => {
    const rng = new SeededRNG(0);
    expect(rng.next()).toBeGreaterThanOrEqual(0);
    expect(rng.next()).not.toBe(0);
  });

  it('returns integers inside the inclusive range', () => {
    const rng = new SeededRNG(7);
    for (let i = 0; i < 500; i++) {
      const value = rng.int(3, 9);
      expect(Number.isInteger(value)).toBe(true);
      expect(value).toBeGreaterThanOrEqual(3);
      expect(value).toBeLessThanOrEqual(9);
    }
  });

  it('picks only from the provided array', () => {
    const rng = new SeededRNG(99);
    const items = ['a', 'b', 'c'] as const;
    for (let i = 0; i < 200; i++) {
      expect(items).toContain(rng.pick(items));
    }
  });

  it('respects chance() bounds', () => {
    const rng = new SeededRNG(5);
    expect(rng.chance(0)).toBe(false);
    expect(rng.chance(1)).toBe(true);
  });
});
