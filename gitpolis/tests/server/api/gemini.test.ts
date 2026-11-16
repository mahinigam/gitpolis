import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGeminiDecisionRequest } from '../../../server/api/gemini';
import {
  GeminiServiceError,
  isProfilePayload,
  requestMunicipalPlan,
  resolveGeminiKey,
} from '../../../server/services/gemini';
import { makeDecisionPlan } from '../../fixtures/decision';
import { makePayload } from '../../fixtures/github';
import { createRequest, createResponse, responseOf } from '../helpers';

vi.mock('../../../server/services/gemini', () => {
  class GeminiServiceError extends Error {
    status: number;

    constructor(message: string, status = 502) {
      super(message);
      this.name = 'GeminiServiceError';
      this.status = status;
    }
  }

  return {
    GeminiServiceError,
    isProfilePayload: vi.fn(),
    requestMunicipalPlan: vi.fn(),
    resolveGeminiKey: vi.fn(),
  };
});

const validPayload = vi.mocked(isProfilePayload);
const requestPlan = vi.mocked(requestMunicipalPlan);
const resolveKey = vi.mocked(resolveGeminiKey);

const JSON_HEADERS = { 'content-type': 'application/json', host: 'localhost:3000' };

let ipCounter = 0;
let ip: string;

beforeEach(() => {
  ipCounter += 1;
  ip = `10.2.0.${ipCounter}`;
  vi.clearAllMocks();
  validPayload.mockImplementation((value) => Boolean(value));
  resolveKey.mockReturnValue('server-key');
});

function request(
  options: {
    method?: string;
    headers?: Record<string, string>;
    body?: string;
  } = {}
) {
  return createRequest({
    method: options.method ?? 'POST',
    headers: options.headers ?? JSON_HEADERS,
    body: options.body,
    remoteAddress: ip,
  });
}

function validBody() {
  return JSON.stringify({ payload: makePayload() });
}

describe('handleGeminiDecisionRequest — request validation', () => {
  it('rejects a non-POST method with Allow', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(request({ method: 'GET' }), res);

    expect(responseOf(res).statusCode).toBe(405);
    expect(responseOf(res).getHeader('allow')).toBe('POST');
  });

  it('rejects a cross-origin request', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(
      request({ headers: { ...JSON_HEADERS, origin: 'https://evil.example' } }),
      res
    );

    expect(responseOf(res).statusCode).toBe(403);
    expect(requestPlan).not.toHaveBeenCalled();
  });

  it('rejects a non-JSON content type', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(
      request({ headers: { 'content-type': 'text/plain' }, body: '{}' }),
      res
    );

    expect(responseOf(res).statusCode).toBe(415);
  });

  it('rejects malformed JSON', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(request({ body: '{oops' }), res);

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /Malformed JSON/ });
  });

  it('rejects a body without a payload', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(request({ body: '{}' }), res);

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /valid GitHub profile payload/ });
  });

  it('rejects a payload the service does not consider a profile', async () => {
    validPayload.mockReturnValue(false);
    const res = createResponse();
    await handleGeminiDecisionRequest(request({ body: validBody() }), res);

    expect(responseOf(res).statusCode).toBe(400);
    expect(requestPlan).not.toHaveBeenCalled();
  });

  it('rejects an oversized request body before validation', async () => {
    const res = createResponse();
    const body = JSON.stringify({ payload: 'x'.repeat(200 * 1024) });
    await handleGeminiDecisionRequest(request({ body }), res);

    expect(responseOf(res).statusCode).toBe(413);
  });

  it('rejects an oversized Gemini key header', async () => {
    const res = createResponse();
    await handleGeminiDecisionRequest(
      request({ headers: { ...JSON_HEADERS, 'x-gemini-key': 'k'.repeat(257) }, body: validBody() }),
      res
    );

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /key is malformed/i });
    expect(requestPlan).not.toHaveBeenCalled();
  });

  it('returns 503 when no key is available', async () => {
    resolveKey.mockReturnValue(undefined);
    const res = createResponse();
    await handleGeminiDecisionRequest(request({ body: validBody() }), res);

    const mock = responseOf(res);
    expect(mock.statusCode).toBe(503);
    expect(mock.json()).toMatchObject({ error: /No Gemini API key configured/ });
  });
});

describe('handleGeminiDecisionRequest — responses', () => {
  it('returns the generated plan', async () => {
    const plan = makeDecisionPlan();
    requestPlan.mockResolvedValue(plan);
    const res = createResponse();

    await handleGeminiDecisionRequest(request({ body: validBody() }), res);

    expect(requestPlan).toHaveBeenCalledTimes(1);
    expect(requestPlan.mock.calls[0][1]).toBe('server-key');
    expect(responseOf(res).statusCode).toBe(200);
    expect(responseOf(res).json()).toEqual({ plan });
  });

  it('passes a repeated key header through as the first value', async () => {
    requestPlan.mockResolvedValue(makeDecisionPlan());
    const res = createResponse();
    const req = request({ body: validBody() });
    req.headers['x-gemini-key'] = ['client-key', 'ignored'];

    await handleGeminiDecisionRequest(req, res);

    expect(resolveKey).toHaveBeenCalledWith('client-key');
  });

  it('maps a GeminiServiceError to its status', async () => {
    requestPlan.mockRejectedValue(new GeminiServiceError('quota exhausted', 429));
    const res = createResponse();

    await handleGeminiDecisionRequest(request({ body: validBody() }), res);

    expect(responseOf(res).statusCode).toBe(429);
    expect(responseOf(res).json()).toEqual({ error: 'quota exhausted' });
  });

  it('hides unexpected errors behind a 502', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    requestPlan.mockRejectedValue(new Error('socket closed'));
    const res = createResponse();

    await handleGeminiDecisionRequest(request({ body: validBody() }), res);

    expect(responseOf(res).statusCode).toBe(502);
    expect(responseOf(res).json()).toEqual({
      error: 'Unexpected error contacting the Gemini Decision API.',
    });
    expect(error).toHaveBeenCalled();
  });
});

describe('handleGeminiDecisionRequest — rate limiting', () => {
  it('limits one IP to 10 plans per minute', async () => {
    requestPlan.mockResolvedValue(makeDecisionPlan());

    for (let i = 0; i < 10; i++) {
      const res = createResponse();
      await handleGeminiDecisionRequest(request({ body: validBody() }), res);
      expect(responseOf(res).statusCode, `request ${i + 1}`).toBe(200);
    }

    const limited = createResponse();
    await handleGeminiDecisionRequest(request({ body: validBody() }), limited);

    expect(responseOf(limited).statusCode).toBe(429);
    expect(responseOf(limited).getHeader('retry-after')).toMatch(/^\d+$/);
    expect(responseOf(limited).json()).toMatchObject({ rateLimited: true });
  });

  it('counts other IPs separately', async () => {
    requestPlan.mockResolvedValue(makeDecisionPlan());

    for (let i = 0; i < 10; i++) {
      await handleGeminiDecisionRequest(request({ body: validBody() }), createResponse());
    }

    const res = createResponse();
    await handleGeminiDecisionRequest(
      createRequest({
        method: 'POST',
        headers: JSON_HEADERS,
        body: validBody(),
        remoteAddress: `${ip}-other`,
      }),
      res
    );

    expect(responseOf(res).statusCode).toBe(200);
  });
});
