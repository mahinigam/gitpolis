import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  GeminiServiceError,
  isProfilePayload,
  requestMunicipalPlan,
  resolveGeminiKey,
} from '../../../server/services/gemini';
import { makeDecisionPlan } from '../../fixtures/decision';
import { makePayload } from '../../fixtures/github';

const PLAN = makeDecisionPlan();
const PAYLOAD = makePayload();
const originalKey = process.env.GEMINI_API_KEY;
const originalModel = process.env.GEMINI_MODEL;

function jsonResponse(body: unknown, status = 200, contentType = 'application/json') {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: { get: (name: string) => (name.toLowerCase() === 'content-type' ? contentType : null) },
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

function candidate(text: string) {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });
}

function success() {
  return candidate(JSON.stringify(PLAN));
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  delete process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
});

afterEach(() => {
  if (originalKey === undefined) delete process.env.GEMINI_API_KEY;
  else process.env.GEMINI_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.GEMINI_MODEL;
  else process.env.GEMINI_MODEL = originalModel;
  vi.unstubAllGlobals();
});

describe('resolveGeminiKey', () => {
  it('returns undefined when neither a server nor client key exists', () => {
    expect(resolveGeminiKey()).toBeUndefined();
    expect(resolveGeminiKey('   ')).toBeUndefined();
  });

  it('uses a trimmed client key', () => {
    expect(resolveGeminiKey('  client-key ')).toBe('client-key');
  });

  it('prefers the server key over a client key', () => {
    process.env.GEMINI_API_KEY = '  server-key  ';

    expect(resolveGeminiKey('client-key')).toBe('server-key');
  });

  it('ignores a blank server key', () => {
    process.env.GEMINI_API_KEY = '   ';

    expect(resolveGeminiKey('client-key')).toBe('client-key');
  });
});

describe('isProfilePayload', () => {
  it('accepts a profile with a login and named repositories', () => {
    expect(isProfilePayload(PAYLOAD)).toBe(true);
  });

  it.each([
    [null],
    [undefined],
    [42],
    ['profile'],
    [{}],
    [{ user: {} }],
    [{ user: { login: '' }, repos: [{ name: 'x' }] }],
    [{ user: { login: 'ada' }, repos: [] }],
    [{ user: { login: 'ada' }, repos: [{}] }],
    [{ user: { login: 'ada' }, repos: [{ name: 42 }] }],
    [{ user: { login: 'ada' }, repos: [null] }],
  ])('rejects %j', (value) => {
    expect(isProfilePayload(value)).toBe(false);
  });

  it('does not require the full domain shape', () => {
    expect(isProfilePayload({ user: { login: 'ada' }, repos: [{ name: 'canal' }], extra: 1 })).toBe(
      true
    );
  });
});

describe('requestMunicipalPlan — success', () => {
  it('calls Gemini with structured output and the API key header', async () => {
    fetchMock.mockResolvedValueOnce(success());

    const plan = await requestMunicipalPlan(PAYLOAD, 'secret-key');

    expect(plan).toEqual(PLAN);
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'
    );
    expect(init.method).toBe('POST');
    expect(init.headers['x-goog-api-key']).toBe('secret-key');
    expect(String(url)).not.toContain('secret-key');

    const body = JSON.parse(init.body);
    expect(body.contents[0].parts[0].text).toContain('DEVELOPER TELEMETRY');
    expect(body.generationConfig.responseMimeType).toBe('application/json');
    expect(body.generationConfig.responseSchema.type).toBe('OBJECT');
    expect(body.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
  });

  it('honours GEMINI_MODEL', async () => {
    process.env.GEMINI_MODEL = '  gemini-custom  ';
    fetchMock.mockResolvedValueOnce(success());

    await requestMunicipalPlan(PAYLOAD, 'key');

    expect(String(fetchMock.mock.calls[0][0])).toContain('/models/gemini-custom:generateContent');
  });
});

describe('requestMunicipalPlan — upstream failures', () => {
  it('does not retry a 429', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'quota' } }, 429));

    const error = await requestMunicipalPlan(PAYLOAD, 'key').catch((cause: unknown) => cause);

    expect(error).toBeInstanceOf(GeminiServiceError);
    expect(error).toMatchObject({ status: 429, message: 'quota' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('does not retry a 400', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: { message: 'bad key' } }, 400));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toMatchObject({
      status: 400,
      message: 'bad key',
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('falls back to gemini-3.5-flash when the primary model returns 404', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          { error: { message: 'models/gemini-2.5-flash is no longer available to new users' } },
          404
        )
      )
      .mockResolvedValueOnce(success());

    const plan = await requestMunicipalPlan(PAYLOAD, 'key');

    expect(plan).toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('gemini-2.5-flash');
    expect(String(fetchMock.mock.calls[1][0])).toContain('gemini-3.5-flash');
  });

  it('maps other statuses to 502 and retries once', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'upstream down' } }, 503))
      .mockResolvedValueOnce(success());

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).resolves.toEqual(PLAN);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('gives up after the retry', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'down' } }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: { message: 'still down' } }, 500));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toMatchObject({
      status: 502,
      message: 'still down',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);

  it('uses the HTTP status for a non-JSON error body', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse('gateway timeout', 504, 'text/plain'))
      .mockResolvedValueOnce(jsonResponse('gateway timeout', 504, 'text/plain'));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toThrow(/Gemini request failed \(504\)/);
  });

  it('retries a network failure and surfaces a generic error', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toMatchObject({
      status: 502,
      message: 'Gemini request failed',
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  }, 10_000);
});

describe('requestMunicipalPlan — output validation', () => {
  it('rejects an empty candidate', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse({ candidates: [] }))
      .mockResolvedValueOnce(jsonResponse({ candidates: [] }));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toThrow(/empty candidate/);
  });

  it('rejects malformed JSON', async () => {
    fetchMock
      .mockResolvedValueOnce(candidate('{broken'))
      .mockResolvedValueOnce(candidate('{broken'));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toThrow(/malformed JSON/);
  });

  it('rejects JSON that does not satisfy the plan contract', async () => {
    fetchMock.mockResolvedValueOnce(candidate('null')).mockResolvedValueOnce(candidate('null'));

    await expect(requestMunicipalPlan(PAYLOAD, 'key')).rejects.toThrow(/decision schema/);
  });

  it('fills missing plan fields with validator defaults', async () => {
    fetchMock.mockResolvedValueOnce(candidate(JSON.stringify({ citySummary: {} })));

    const plan = await requestMunicipalPlan(PAYLOAD, 'key');

    expect(plan.username).toBe(PAYLOAD.user.login);
    expect(plan.citySummary.civicTitle).toBe(`Metropolis of @${PAYLOAD.user.login}`);
    expect(plan.districts).toEqual([]);
  });
});
