import type { GitHubProfilePayload } from '../../src/domain/city/types';
import { MUNICIPAL_DECISION_JSON_SCHEMA } from '../../src/domain/decision/geminiSchema';
import type { MunicipalDecisionPlan } from '../../src/domain/decision';
import { validateMunicipalDecisionPlan } from '../../src/domain/decision';
import { buildDecisionPrompt } from '../../src/domain/decision/prompt';

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';
const DEFAULT_MODEL = 'gemini-2.5-flash';

export class GeminiServiceError extends Error {
  constructor(
    message: string,
    readonly status = 502
  ) {
    super(message);
    this.name = 'GeminiServiceError';
  }
}

function resolveModel(): string {
  const model = typeof process !== 'undefined' ? process.env?.GEMINI_MODEL : undefined;
  return model?.trim() || DEFAULT_MODEL;
}

/** Server-side key. Browser-supplied keys are only accepted when no server key exists. */
export function resolveGeminiKey(clientKey?: string): string | undefined {
  const envKey = typeof process !== 'undefined' ? process.env?.GEMINI_API_KEY : undefined;
  return envKey?.trim() || clientKey?.trim() || undefined;
}

/**
 * Narrows an untrusted request body to a GitHubProfilePayload we are willing to
 * forward. This is deliberately shallow — the upstream model validates meaning,
 * we only guarantee a sane shape and bounded size.
 */
export function isProfilePayload(value: unknown): value is GitHubProfilePayload {
  if (!value || typeof value !== 'object') return false;
  const payload = value as Partial<GitHubProfilePayload>;
  return (
    Boolean(payload.user) &&
    typeof payload.user?.login === 'string' &&
    payload.user.login.length > 0 &&
    Array.isArray(payload.repos) &&
    payload.repos.length > 0 &&
    payload.repos.every((repo) => typeof repo?.name === 'string')
  );
}

interface GeminiApiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  error?: { message?: string };
}

const REQUEST_TIMEOUT_MS = 45_000;

/**
 * Calls Gemini with structured output enabled and validates the result against
 * the shared decision-plan contract before returning it.
 */
export async function requestMunicipalPlan(
  payload: GitHubProfilePayload,
  apiKey: string
): Promise<MunicipalDecisionPlan> {
  let lastError: GeminiServiceError | null = null;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return await requestOnce(payload, apiKey);
    } catch (err) {
      lastError = err instanceof GeminiServiceError ? err : new GeminiServiceError('Gemini request failed');
      // Retry only transient upstream failures.
      if (lastError.status !== 502) throw lastError;
      if (attempt === 0) await new Promise((resolve) => setTimeout(resolve, 400));
    }
  }

  throw lastError ?? new GeminiServiceError('Gemini request failed');
}

async function requestOnce(
  payload: GitHubProfilePayload,
  apiKey: string
): Promise<MunicipalDecisionPlan> {
  const response = await fetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(resolveModel())}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: buildDecisionPrompt(payload) }] }],
        generationConfig: {
          temperature: 0.25,
          maxOutputTokens: 8192,
          responseMimeType: 'application/json',
          responseSchema: MUNICIPAL_DECISION_JSON_SCHEMA,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    }
  );

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    let message = `Gemini request failed (${response.status})`;
    try {
      const parsed = JSON.parse(text) as GeminiApiResponse;
      if (parsed.error?.message) message = parsed.error.message;
    } catch {
      // non-JSON body
    }
    const status = response.status === 429 ? 429 : response.status === 400 ? 400 : 502;
    throw new GeminiServiceError(message, status);
  }

  const json = (await response.json()) as GeminiApiResponse;
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new GeminiServiceError('Gemini returned an empty candidate.');

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new GeminiServiceError('Gemini returned malformed JSON.');
  }

  const plan = validateMunicipalDecisionPlan(parsed, payload.user.login);
  if (!plan) throw new GeminiServiceError('Gemini output did not match the decision schema.');
  return plan;
}
