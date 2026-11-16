import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  computeProfileFingerprint,
  executeGeminiMunicipalDecisions,
} from '../../../src/services/gemini/client';
import { setCachedDecision } from '../../../src/services/gemini/cache';
import { computeProfileFingerprint as computeFingerprint } from '../../../src/domain/github/fingerprint';
import { makeDecisionPlan } from '../../fixtures/decision';
import { makePayload } from '../../fixtures/github';

const PAYLOAD = makePayload();
const PLAN = makeDecisionPlan();

function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: 'Status',
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function directCandidate(plan: unknown = PLAN) {
  return jsonResponse({
    candidates: [{ content: { parts: [{ text: JSON.stringify(plan) }] } }],
  });
}

const PROXY_404 = jsonResponse({ error: 'not found' }, 404);

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  sessionStorage.clear();
});

afterEach(() => {
  sessionStorage.clear();
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('executeGeminiMunicipalDecisions — proxy transport', () => {
  it('returns the validated plan from the same-origin proxy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ plan: PLAN }));
    const progress: string[] = [];

    const result = await executeGeminiMunicipalDecisions(PAYLOAD, undefined, (status) =>
      progress.push(status)
    );

    expect(result).toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toBe('/api/gemini/decisions');
    expect(fetchMock.mock.calls[0][1].method).toBe('POST');
    expect(progress[0]).toContain('Consulting');
    expect(progress.some((status) => status.includes('Validating'))).toBe(true);
    expect(progress.at(-1)).toContain('cached');
  });

  it('sends the profile payload and optional key to the proxy', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ plan: PLAN }));

    await executeGeminiMunicipalDecisions(PAYLOAD, 'client-key');

    const init = fetchMock.mock.calls[0][1];
    expect(init.headers['x-gemini-key']).toBe('client-key');
    expect(JSON.parse(init.body)).toEqual({ payload: PAYLOAD });
  });

  it('works without a client key when the server owns one', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ plan: PLAN }));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD)).resolves.toEqual(PLAN);

    expect(fetchMock.mock.calls[0][1].headers['x-gemini-key']).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('surfaces a proxy error without falling back to a direct call', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'Quota exceeded' }, 429));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow('Quota exceeded');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats a 200 HTML response as "no proxy" and calls Gemini directly', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse('<html></html>', 200, 'text/html'))
      .mockResolvedValueOnce(directCandidate());

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).resolves.toEqual(PLAN);

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1][0])).toContain('generativelanguage.googleapis.com');
  });

  it('treats a missing plan field as "no proxy"', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({}, 200))
      .mockResolvedValueOnce(directCandidate());

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).resolves.toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('treats unparseable proxy JSON as "no proxy"', async () => {
    fetchMock
      .mockResolvedValueOnce({
        ...jsonResponse({}, 200),
        json: async () => {
          throw new Error('bad json');
        },
      })
      .mockResolvedValueOnce(directCandidate());

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).resolves.toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe('executeGeminiMunicipalDecisions — direct transport', () => {
  it('falls back to the direct API when the proxy is unreachable', async () => {
    fetchMock
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValueOnce(directCandidate());

    const result = await executeGeminiMunicipalDecisions(PAYLOAD, 'direct-key');

    expect(result).toEqual(PLAN);
    const [url, init] = fetchMock.mock.calls[1];
    expect(String(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    );
    expect(init.headers['x-goog-api-key']).toBe('direct-key');
    expect(init.headers.Authorization).toBeUndefined();
    expect(String(url)).not.toContain('key=');
    expect(String(url)).not.toContain('direct-key');
  });

  it('requests structured JSON with thinking disabled', async () => {
    fetchMock.mockResolvedValueOnce(PROXY_404).mockResolvedValueOnce(directCandidate());

    await executeGeminiMunicipalDecisions(PAYLOAD, 'key');

    const body = JSON.parse(fetchMock.mock.calls[1][1].body);
    expect(body.contents[0].role).toBe('user');
    expect(body.contents[0].parts[0].text).toContain('DEVELOPER TELEMETRY');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    expect(body.generationConfig.maxOutputTokens).toBeGreaterThanOrEqual(4_096);
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
  });

  it('uses the key stored in sessionStorage when no override is given', async () => {
    sessionStorage.setItem('gitpolis_gemini_api_key', 'session-key');
    fetchMock.mockResolvedValueOnce(PROXY_404).mockResolvedValueOnce(directCandidate());

    await executeGeminiMunicipalDecisions(PAYLOAD);

    expect(fetchMock.mock.calls[1][1].headers['x-goog-api-key']).toBe('session-key');
  });

  it('requires a key when no proxy and no stored key exist', async () => {
    fetchMock.mockRejectedValueOnce(new Error('offline'));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD)).rejects.toThrow(
      /Gemini API key is required/
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a terminal 4xx response', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'API key not valid' } }, 400));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'bad-key')).rejects.toThrow(
      /Gemini \(400\): API key not valid/
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('retries once on a 5xx response and succeeds', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'backend down' } }, 500))
      .mockResolvedValueOnce(directCandidate());

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).resolves.toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('gives up after a second 5xx response', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'backend down' } }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'still down' } }, 503));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow(
      /Gemini \(503\): still down/
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('reports a non-JSON error body with the HTTP status', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(jsonResponse('bad gateway', 502, 'text/plain'))
      .mockResolvedValueOnce(jsonResponse('bad gateway', 502, 'text/plain'));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow(/502/);
  });

  it('rejects an empty candidate', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [] } }] }))
      .mockResolvedValueOnce(jsonResponse({ candidates: [{ content: { parts: [] } }] }));

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow(
      /empty output candidate/
    );
  });

  it('rejects malformed JSON inside the candidate', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{broken' }] } }] })
      )
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: '{broken' }] } }] })
      );

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow(
      /malformed JSON/
    );
  });

  it('rejects a plan that cannot satisfy the schema contract', async () => {
    fetchMock
      .mockResolvedValueOnce(PROXY_404)
      .mockResolvedValueOnce(
        jsonResponse({ candidates: [{ content: { parts: [{ text: 'null' }] } }] })
      );

    await expect(executeGeminiMunicipalDecisions(PAYLOAD, 'key')).rejects.toThrow(
      /Failed to validate/
    );
  });
});

describe('executeGeminiMunicipalDecisions — caching', () => {
  it('returns a cached plan without calling the network', async () => {
    const cacheKey = computeProfileFingerprint(PAYLOAD);
    await setCachedDecision(cacheKey, PLAN);
    const progress: string[] = [];

    const result = await executeGeminiMunicipalDecisions(PAYLOAD, undefined, (status) =>
      progress.push(status)
    );

    expect(result).toEqual(PLAN);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(progress).toEqual(['Loaded cached AI Municipal Blueprint instantly']);
  });

  it('stores a freshly generated plan under the profile fingerprint', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ plan: PLAN }));

    await executeGeminiMunicipalDecisions(PAYLOAD, 'key');
    fetchMock.mockClear();
    const cached = await executeGeminiMunicipalDecisions(PAYLOAD, 'key');

    expect(cached).toEqual(PLAN);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('re-exports the same fingerprint implementation', () => {
    expect(computeProfileFingerprint).toBe(computeFingerprint);
    expect(computeProfileFingerprint(PAYLOAD)).toMatch(/^v2:/);
  });
});
