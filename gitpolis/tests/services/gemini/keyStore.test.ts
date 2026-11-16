import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getStoredGeminiKey,
  setStoredGeminiKey,
} from '../../../src/services/gemini/keyStore';

const STORAGE_KEY = 'gitpolis_gemini_api_key';

beforeEach(() => {
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  vi.restoreAllMocks();
});

describe('getStoredGeminiKey', () => {
  it('returns an empty string when nothing is stored', () => {
    expect(getStoredGeminiKey()).toBe('');
  });

  it('reads the key from sessionStorage', () => {
    sessionStorage.setItem(STORAGE_KEY, 'stored-key');

    expect(getStoredGeminiKey()).toBe('stored-key');
  });

  it('returns an empty string when storage access throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });

    expect(getStoredGeminiKey()).toBe('');
  });
});

describe('setStoredGeminiKey', () => {
  it('stores a trimmed key', () => {
    setStoredGeminiKey('  secret-key  ');

    expect(sessionStorage.getItem(STORAGE_KEY)).toBe('secret-key');
    expect(getStoredGeminiKey()).toBe('secret-key');
  });

  it('removes the key for blank input', () => {
    setStoredGeminiKey('secret-key');
    setStoredGeminiKey('   ');

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('removes the key for an empty string', () => {
    setStoredGeminiKey('secret-key');
    setStoredGeminiKey('');

    expect(sessionStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('ignores storage write failures', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota exceeded');
    });

    expect(() => setStoredGeminiKey('secret-key')).not.toThrow();
  });

  it('does not fall back to localStorage', () => {
    setStoredGeminiKey('secret-key');

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
