import type { MunicipalDecisionPlan } from '../../domain/decision';

const DB_NAME = 'gitpolis_ai_cache';
const DB_VERSION = 1;
const STORE_NAME = 'decisions';
const LS_PREFIX = 'gitpolis_plan_';

function openCacheDatabase(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof window === 'undefined' || !window.indexedDB) {
      resolve(null);
      return;
    }
    const request = window.indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'key' });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

/**
 * Reads a cached plan from IndexedDB, falling back to localStorage.
 * Returns null on any failure — a cache miss must never break city generation.
 */
export async function getCachedDecision(key: string): Promise<MunicipalDecisionPlan | null> {
  try {
    const db = await openCacheDatabase();
    if (db) {
      return await new Promise<MunicipalDecisionPlan | null>((resolve) => {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const req = tx.objectStore(STORE_NAME).get(key);
        req.onsuccess = () => {
          resolve(req.result?.plan ? (req.result.plan as MunicipalDecisionPlan) : null);
        };
        req.onerror = () => resolve(null);
      });
    }

    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as MunicipalDecisionPlan) : null;
  } catch {
    return null;
  }
}

/** Persists a plan to IndexedDB and mirrors it to localStorage. */
export async function setCachedDecision(key: string, plan: MunicipalDecisionPlan): Promise<void> {
  try {
    const db = await openCacheDatabase();
    if (db) {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      tx.objectStore(STORE_NAME).put({ key, plan, timestamp: Date.now() });
    }
    localStorage.setItem(`${LS_PREFIX}${key}`, JSON.stringify(plan));
  } catch (err) {
    // Quota or private-mode failures are non-fatal.
    console.warn('[Decision Cache] Cache write warning:', err);
  }
}

/** Synchronous localStorage-only read, used during synchronous app boot. */
export function getCachedDecisionSync(key: string): MunicipalDecisionPlan | null {
  try {
    const raw = localStorage.getItem(`${LS_PREFIX}${key}`);
    return raw ? (JSON.parse(raw) as MunicipalDecisionPlan) : null;
  } catch {
    return null;
  }
}
