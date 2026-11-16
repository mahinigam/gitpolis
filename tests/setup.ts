import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

// jsdom only exposes storage for a non-opaque origin (see vitest.config.ts).
// Node 22 also ships an experimental global `localStorage` that is `undefined`
// without `--localstorage-file`; because it already exists on globalThis,
// Vitest does not copy jsdom's implementation over it. Install a small
// in-memory Storage so cache/key tests exercise real read/write behaviour.
class MemoryStorage {
  private readonly store = new Map<string, string>();

  get length(): number {
    return this.store.size;
  }

  clear(): void {
    this.store.clear();
  }

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  key(index: number): string | null {
    return Array.from(this.store.keys())[index] ?? null;
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  setItem(key: string, value: string): void {
    this.store.set(String(key), String(value));
  }
}

function isStorageFunctional(storage: Storage | undefined): boolean {
  try {
    if (!storage) return false;
    storage.setItem('__storage_test__', '1');
    storage.removeItem('__storage_test__');
    return true;
  } catch {
    return false;
  }
}

if (!isStorageFunctional(globalThis.localStorage)) {
  const memStorage = new MemoryStorage() as unknown as Storage;
  Object.defineProperty(globalThis, 'localStorage', {
    value: memStorage,
    configurable: true,
    writable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'localStorage', {
      value: memStorage,
      configurable: true,
      writable: true,
    });
  }
}

if (!isStorageFunctional(globalThis.sessionStorage)) {
  const memStorage = new MemoryStorage() as unknown as Storage;
  Object.defineProperty(globalThis, 'sessionStorage', {
    value: memStorage,
    configurable: true,
    writable: true,
  });
  if (typeof window !== 'undefined') {
    Object.defineProperty(window, 'sessionStorage', {
      value: memStorage,
      configurable: true,
      writable: true,
    });
  }
}

afterEach(() => {
  cleanup();
  globalThis.localStorage?.clear();
  vi.restoreAllMocks();
});

// jsdom does not implement these browser APIs that the HUD relies on.
if (!globalThis.ResizeObserver) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof ResizeObserver;
}

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

if (!HTMLCanvasElement.prototype.getContext) {
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

// jsdom has no WebGL; the engine tests stub the module instead.
if (!window.requestAnimationFrame) {
  window.requestAnimationFrame = ((cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0) as unknown as number) as typeof requestAnimationFrame;
  window.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof cancelAnimationFrame;
}
