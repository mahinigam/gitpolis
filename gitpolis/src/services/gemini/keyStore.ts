/**
 * Storage for a user-supplied Gemini API key.
 *
 * Held in sessionStorage rather than localStorage: a paid API key does not
 * need to survive a browser restart, and a shorter lifetime limits exposure if
 * the machine is shared. It is never written into URLs or logs.
 */
const GEMINI_API_STORAGE_KEY = 'gitpolis_gemini_api_key';

export function getStoredGeminiKey(): string {
  if (typeof window === 'undefined') return '';
  try {
    return sessionStorage.getItem(GEMINI_API_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function setStoredGeminiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    if (!key.trim()) {
      sessionStorage.removeItem(GEMINI_API_STORAGE_KEY);
    } else {
      sessionStorage.setItem(GEMINI_API_STORAGE_KEY, key.trim());
    }
  } catch {
    // Storage can be unavailable (private mode); ignore.
  }
}
