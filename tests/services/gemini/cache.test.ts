import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCachedDecision,
  getCachedDecisionSync,
  setCachedDecision,
} from '../../../src/services/gemini/cache';
import { makeDecisionPlan } from '../../fixtures/decision';

const LS_PREFIX = 'gitpolis_plan_';
const KEY = 'v2:ada:1:10:1704067200000:123';
const originalIndexedDb = Object.getOwnPropertyDescriptor(window, 'indexedDB');

function useNoIndexedDb() {
  Object.defineProperty(window, 'indexedDB', { value: undefined, configurable: true });
}

interface FakeIndexedDbOptions {
  failOpen?: boolean;
}

/** Minimal IndexedDB double implementing exactly what the cache uses. */
function useFakeIndexedDb(options: FakeIndexedDbOptions = {}) {
  const stores = new Map<string, Map<string, { key: string; plan: unknown }>>();

  const factory = {
    open: () => {
      const request = {
        result: null as unknown,
        onsuccess: null as (() => void) | null,
        onerror: null as (() => void) | null,
        onupgradeneeded: null as (() => void) | null,
      };

      setTimeout(() => {
        if (options.failOpen) {
          request.onerror?.();
          return;
        }

        const db = {
          objectStoreNames: { contains: (name: string) => stores.has(name) },
          createObjectStore: (name: string) => {
            stores.set(name, new Map());
            return {};
          },
          transaction: () => ({
            objectStore: () => ({
              get: (key: string) => {
                const getRequest = {
                  result: undefined as { plan?: unknown } | undefined,
                  onsuccess: null as (() => void) | null,
                  onerror: null as (() => void) | null,
                };
                setTimeout(() => {
                  getRequest.result = stores.get('decisions')?.get(key);
                  getRequest.onsuccess?.();
                }, 0);
                return getRequest;
              },
              put: (value: { key: string; plan: unknown }) => {
                stores.get('decisions')?.set(value.key, value);
              },
            }),
          }),
        };

        request.result = db;
        if (!stores.has('decisions')) request.onupgradeneeded?.();
        request.onsuccess?.();
      }, 0);

      return request;
    },
  };

  Object.defineProperty(window, 'indexedDB', {
    value: factory as unknown as IDBFactory,
    configurable: true,
  });
}

beforeEach(() => {
  useNoIndexedDb();
  localStorage.clear();
});

afterAll(() => {
  if (originalIndexedDb) Object.defineProperty(window, 'indexedDB', originalIndexedDb);
  else delete (window as { indexedDB?: unknown }).indexedDB;
});

describe('cache without IndexedDB', () => {
  it('returns null for a cold cache', async () => {
    await expect(getCachedDecision(KEY)).resolves.toBeNull();
  });

  it('round-trips a plan through localStorage', async () => {
    const plan = makeDecisionPlan();

    await setCachedDecision(KEY, plan);

    await expect(getCachedDecision(KEY)).resolves.toEqual(plan);
    expect(localStorage.getItem(`${LS_PREFIX}${KEY}`)).not.toBeNull();
  });

  it('namespaces entries by fingerprint', async () => {
    const first = makeDecisionPlan({ id: 'first' });
    const second = makeDecisionPlan({ id: 'second', username: 'grace' });

    await setCachedDecision('fingerprint-a', first);
    await setCachedDecision('fingerprint-b', second);

    await expect(getCachedDecision('fingerprint-a')).resolves.toMatchObject({ id: 'first' });
    await expect(getCachedDecision('fingerprint-b')).resolves.toMatchObject({ id: 'second' });
  });

  it('returns null for corrupt cached JSON instead of throwing', async () => {
    localStorage.setItem(`${LS_PREFIX}${KEY}`, '{not json');

    await expect(getCachedDecision(KEY)).resolves.toBeNull();
    expect(getCachedDecisionSync(KEY)).toBeNull();
  });
});

describe('getCachedDecisionSync', () => {
  it('reads the localStorage mirror synchronously', () => {
    const plan = makeDecisionPlan();
    localStorage.setItem(`${LS_PREFIX}${KEY}`, JSON.stringify(plan));

    expect(getCachedDecisionSync(KEY)).toEqual(plan);
  });

  it('returns null on a miss', () => {
    expect(getCachedDecisionSync('missing')).toBeNull();
  });

  it('returns null when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getCachedDecisionSync(KEY)).toBeNull();
  });
});

describe('cache with IndexedDB', () => {
  it('round-trips a plan through IndexedDB and mirrors it to localStorage', async () => {
    useFakeIndexedDb();
    const plan = makeDecisionPlan();

    await setCachedDecision(KEY, plan);

    await expect(getCachedDecision(KEY)).resolves.toEqual(plan);
    expect(getCachedDecisionSync(KEY)).toEqual(plan);
  });

  it('returns null when the record is missing', async () => {
    useFakeIndexedDb();

    await expect(getCachedDecision('absent')).resolves.toBeNull();
  });

  it('falls back to localStorage when IndexedDB fails to open', async () => {
    useFakeIndexedDb({ failOpen: true });
    const plan = makeDecisionPlan({ id: 'ls-fallback' });
    localStorage.setItem(`${LS_PREFIX}${KEY}`, JSON.stringify(plan));

    await expect(getCachedDecision(KEY)).resolves.toMatchObject({ id: 'ls-fallback' });
  });

  it('still succeeds when the localStorage mirror cannot be written', async () => {
    useFakeIndexedDb();
    const plan = makeDecisionPlan();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(localStorage, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    await expect(setCachedDecision(KEY, plan)).resolves.toBeUndefined();
    await expect(getCachedDecision(KEY)).resolves.toEqual(plan);
    expect(warn).toHaveBeenCalled();
  });
});
