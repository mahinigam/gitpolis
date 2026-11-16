/**
 * Google Gemini "municipal decision" client.
 *
 * Two transports, tried in order:
 *   1. `POST /api/gemini/decisions` — same-origin proxy. Keeps the API key on
 *      the server and gives us a single place to rate-limit and validate.
 *   2. Direct `generativelanguage.googleapis.com` call with the key in the
 *      `x-goog-api-key` header (never the query string, which leaks into
 *      proxy logs and browser history).
 *
 * Results are cached by profile fingerprint, so repeat visits cost nothing.
 */
import type { GitHubProfilePayload } from '../../domain/city/types';
import { validateMunicipalDecisionPlan, type MunicipalDecisionPlan } from '../../domain/decision';
import { MUNICIPAL_DECISION_JSON_SCHEMA } from '../../domain/decision/geminiSchema';
import { buildDecisionPrompt } from '../../domain/decision/prompt';
import { computeProfileFingerprint } from '../../domain/github/fingerprint';
import { getCachedDecision, setCachedDecision } from './cache';
import { getStoredGeminiKey } from './keyStore';

const DEFAULT_MODEL = 'gemini-3.5-flash';
export const FALLBACK_MODELS = [
  'gemini-3.5-flash',
  'gemini-3-flash-preview',
  'gemini-2.5-flash',
] as const;
const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export type DecisionProgressCallback = (statusText: string) => void;

/** Shared generation settings. Thinking is disabled so output tokens go to JSON. */
function buildGenerationConfig() {
  return {
    temperature: 0.25,
    // Structured JSON for 12 districts needs headroom; 4096 truncates.
    maxOutputTokens: 8192,
    responseMimeType: 'application/json',
    responseSchema: MUNICIPAL_DECISION_JSON_SCHEMA,
    thinkingConfig: { thinkingBudget: 0 },
  };
}

const REQUEST_TIMEOUT_MS = 45_000;

interface DirectGeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

function extractErrorText(raw: string, status: number, statusText: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } };
    if (parsed.error?.message) return `Gemini (${status}): ${parsed.error.message}`;
  } catch {
    // non-JSON error body
  }
  return `Gemini Decision API Error (${status}): ${statusText}`;
}

/** Calls Gemini directly from the browser. Used when the proxy is unavailable. */
async function requestDirect(
  payload: GitHubProfilePayload,
  apiKey: string,
  model: string
): Promise<unknown> {
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(model)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildDecisionPrompt(payload) }] }],
        generationConfig: buildGenerationConfig(),
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    throw new Error(extractErrorText(await response.text(), response.status, response.statusText));
  }

  const json = (await response.json()) as DirectGeminiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error('Gemini Decision API returned an empty output candidate.');
  try {
    return JSON.parse(text);
  } catch {
    throw new Error('Gemini Decision API returned malformed JSON.');
  }
}

/** One retry for transient (5xx / network) failures; 404 falls back to modern models; other 4xx is terminal. */
async function requestDirectWithRetry(
  payload: GitHubProfilePayload,
  apiKey: string,
  model: string
): Promise<unknown> {
  const modelsToTry = [model, ...FALLBACK_MODELS.filter((m) => m !== model)];
  let lastError: Error | null = null;

  for (const currentModel of modelsToTry) {
    try {
      const firstError = await requestDirect(payload, apiKey, currentModel).catch((err: unknown) => err);
      if (!(firstError instanceof Error)) return firstError;

      // Model retired or not found — fall back to the next candidate model
      if (
        /\b404\b/.test(firstError.message) ||
        /not found|no longer available/i.test(firstError.message)
      ) {
        lastError = firstError;
        continue;
      }

      // Other 4xx client errors (e.g. 400 invalid key, 429 quota) are terminal
      if (/\b4\d{2}\b/.test(firstError.message)) throw firstError;

      // Retry once on transient 5xx / network error
      return await requestDirect(payload, apiKey, currentModel);
    } catch (err) {
      if (err instanceof Error) {
        if (
          /\b404\b/.test(err.message) ||
          /not found|no longer available/i.test(err.message)
        ) {
          lastError = err;
          continue;
        }
        throw err;
      }
    }
  }

  throw lastError ?? new Error('Gemini Decision API failed across all available models.');
}

/** Calls the same-origin proxy, which owns the server-side key. */
async function requestViaProxy(
  payload: GitHubProfilePayload,
  apiKey: string
): Promise<unknown | null> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (apiKey) headers['x-gemini-key'] = apiKey;

  let response: Response;
  try {
    response = await fetch('/api/gemini/decisions', {
      method: 'POST',
      headers,
      body: JSON.stringify({ payload }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });
  } catch {
    return null; // no local/preview server — fall through to direct transport
  }

  // 404 means the deployment does not expose the proxy at all.
  if (response.status === 404) return null;

  const contentType = response.headers.get('content-type') || '';
  // A static host with SPA rewrites answers /api/* with index.html (200).
  // That is "no proxy available", not a hard failure.
  if (!contentType.includes('application/json')) return null;

  const body = (await response.json().catch(() => null)) as
    | { plan?: unknown; error?: string }
    | null;

  if (!response.ok) {
    throw new Error(body?.error || `Gemini proxy error (${response.status})`);
  }
  if (!body?.plan) return null;
  return body.plan;
}

/**
 * Generates (or loads from cache) the AI municipal plan for a profile.
 *
 * @param payload    The GitHub profile the city is built from.
 * @param apiKeyOverride  Optional key supplied by the user in the UI.
 * @param onProgress Callback receiving human-readable status updates.
 */
export async function executeGeminiMunicipalDecisions(
  payload: GitHubProfilePayload,
  apiKeyOverride?: string,
  onProgress?: DecisionProgressCallback
): Promise<MunicipalDecisionPlan> {
  const username = payload.user.login;
  const cacheKey = computeProfileFingerprint(payload);

  const cached = await getCachedDecision(cacheKey);
  if (cached) {
    onProgress?.('Loaded cached AI Municipal Blueprint instantly');
    return cached;
  }

  const apiKey = (apiKeyOverride || getStoredGeminiKey()).trim();
  const model = (import.meta as { env?: Record<string, string> }).env?.VITE_GEMINI_MODEL || DEFAULT_MODEL;

  onProgress?.('Consulting Google Decision Engine…');

  let rawPlan = await requestViaProxy(payload, apiKey);
  if (!rawPlan) {
    if (!apiKey) {
      throw new Error(
        'A Gemini API key is required. Add a free Google AI Studio key, or configure GEMINI_API_KEY on the server.'
      );
    }
    rawPlan = await requestDirectWithRetry(payload, apiKey, model);
  }

  onProgress?.('Validating structured decision schema contract…');
  const validatedPlan = validateMunicipalDecisionPlan(rawPlan, username);
  if (!validatedPlan) {
    throw new Error('Failed to validate MunicipalDecisionPlan against strict contract schema.');
  }

  await setCachedDecision(cacheKey, validatedPlan);
  onProgress?.('AI Municipal Decisions verified and cached');

  return validatedPlan;
}

export { computeProfileFingerprint };
export { getStoredGeminiKey, setStoredGeminiKey } from './keyStore';
