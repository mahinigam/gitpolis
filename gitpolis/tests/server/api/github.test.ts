import { beforeEach, describe, expect, it, vi } from 'vitest';
import { handleGithubProfileRequest } from '../../../server/api/github';
import {
  fetchGitHubProfileForCity,
  GitHubServiceError,
} from '../../../server/services/github';
import { makePayload } from '../../fixtures/github';
import { createRequest, createResponse, responseOf } from '../helpers';

vi.mock('../../../server/services/github', () => {
  class GitHubServiceError extends Error {
    status: number;
    rateLimited: boolean;
    resetAt?: number;

    constructor(message: string, status: number, rateLimited = false, resetAt?: number) {
      super(message);
      this.name = 'GitHubServiceError';
      this.status = status;
      this.rateLimited = rateLimited;
      this.resetAt = resetAt;
    }
  }

  return { GitHubServiceError, fetchGitHubProfileForCity: vi.fn() };
});

const fetchProfile = vi.mocked(fetchGitHubProfileForCity);

let ipCounter = 0;
let ip: string;

beforeEach(() => {
  ipCounter += 1;
  ip = `10.1.0.${ipCounter}`;
  vi.clearAllMocks();
});

function request(overrides: { method?: string; headers?: Record<string, string> } = {}) {
  return createRequest({
    method: overrides.method ?? 'GET',
    headers: { host: 'localhost:3000', ...overrides.headers },
    remoteAddress: ip,
  });
}

describe('handleGithubProfileRequest — request validation', () => {
  it('rejects a non-GET method with Allow', async () => {
    const res = createResponse();
    await handleGithubProfileRequest(request({ method: 'POST' }), res, 'ada');

    const mock = responseOf(res);
    expect(mock.statusCode).toBe(405);
    expect(mock.getHeader('allow')).toBe('GET');
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('rejects a cross-origin request', async () => {
    const res = createResponse();
    await handleGithubProfileRequest(
      request({ headers: { origin: 'https://evil.example' } }),
      res,
      'ada'
    );

    expect(responseOf(res).statusCode).toBe(403);
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('rejects a missing or blank username', async () => {
    for (const raw of ['', '   ', '%20']) {
      const res = createResponse();
      await handleGithubProfileRequest(request(), res, raw);
      expect(responseOf(res).statusCode, raw).toBe(400);
    }
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('rejects malformed percent-encoding instead of throwing', async () => {
    const res = createResponse();

    await expect(
      handleGithubProfileRequest(request(), res, '%E0%A4%A')
    ).resolves.toBeUndefined();

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /invalid characters/i });
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('rejects a username longer than 39 characters', async () => {
    const res = createResponse();
    await handleGithubProfileRequest(request(), res, 'a'.repeat(40));

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /too long/i });
  });

  it('rejects an oversized token header', async () => {
    const res = createResponse();
    await handleGithubProfileRequest(
      request({ headers: { 'x-github-token': 't'.repeat(513) } }),
      res,
      'ada'
    );

    expect(responseOf(res).statusCode).toBe(400);
    expect(responseOf(res).json()).toMatchObject({ error: /token is malformed/i });
    expect(fetchProfile).not.toHaveBeenCalled();
  });

  it('accepts a token at the maximum length', async () => {
    fetchProfile.mockResolvedValue(makePayload());
    const res = createResponse();

    await handleGithubProfileRequest(
      request({ headers: { 'x-github-token': 't'.repeat(512) } }),
      res,
      'ada'
    );

    expect(responseOf(res).statusCode).toBe(200);
    expect(fetchProfile).toHaveBeenCalledWith('ada', 't'.repeat(512));
  });

  it('uses the first value when the token header repeats', async () => {
    fetchProfile.mockResolvedValue(makePayload());
    const res = createResponse();
    const req = request();
    req.headers['x-github-token'] = ['first', 'second'];

    await handleGithubProfileRequest(req, res, 'ada');

    expect(fetchProfile).toHaveBeenCalledWith('ada', 'first');
  });
});

describe('handleGithubProfileRequest — responses', () => {
  it('decodes the path segment and returns the payload', async () => {
    const payload = makePayload();
    fetchProfile.mockResolvedValue(payload);
    const res = createResponse();

    await handleGithubProfileRequest(request(), res, 'ada%2Dlovelace');

    expect(fetchProfile).toHaveBeenCalledWith('ada-lovelace', undefined);
    const mock = responseOf(res);
    expect(mock.statusCode).toBe(200);
    expect(mock.getHeader('cache-control')).toBe('no-store');
    expect(mock.json()).toEqual(payload);
  });

  it('maps a GitHubServiceError to its status and metadata', async () => {
    fetchProfile.mockRejectedValue(
      new GitHubServiceError('Rate limit reached', 429, true, 1_700_000_000_000)
    );
    const res = createResponse();

    await handleGithubProfileRequest(request(), res, 'ada');

    const mock = responseOf(res);
    expect(mock.statusCode).toBe(429);
    expect(mock.json()).toMatchObject({
      error: 'Rate limit reached',
      rateLimited: true,
      resetAt: 1_700_000_000_000,
    });
  });

  it('hides unexpected errors behind a 500', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchProfile.mockRejectedValue(new Error('database exploded'));
    const res = createResponse();

    await handleGithubProfileRequest(request(), res, 'ada');

    expect(responseOf(res).statusCode).toBe(500);
    expect(responseOf(res).json()).toEqual({
      error: 'Unexpected server error fetching GitHub profile.',
    });
    expect(error).toHaveBeenCalled();
  });
});

describe('handleGithubProfileRequest — rate limiting', () => {
  it('limits one IP to 30 requests per minute', async () => {
    fetchProfile.mockResolvedValue(makePayload());

    let last = createResponse();
    for (let i = 0; i < 30; i++) {
      last = createResponse();
      await handleGithubProfileRequest(request(), last, 'ada');
      expect(responseOf(last).statusCode, `request ${i + 1}`).toBe(200);
    }

    const limited = createResponse();
    await handleGithubProfileRequest(request(), limited, 'ada');

    expect(responseOf(limited).statusCode).toBe(429);
    expect(responseOf(limited).getHeader('retry-after')).toMatch(/^\d+$/);
    expect(responseOf(limited).json()).toMatchObject({ rateLimited: true });
  });

  it('counts other IPs separately', async () => {
    fetchProfile.mockResolvedValue(makePayload());
    const otherIp = `${ip}-other`;

    for (let i = 0; i < 30; i++) {
      await handleGithubProfileRequest(request(), createResponse(), 'ada');
    }

    const res = createResponse();
    await handleGithubProfileRequest(
      createRequest({ headers: { host: 'localhost:3000' }, remoteAddress: otherIp }),
      res,
      'ada'
    );

    expect(responseOf(res).statusCode).toBe(200);
  });
});
