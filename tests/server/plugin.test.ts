import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiMiddleware, gitPolisApiPlugin } from '../../server/plugin';
import { handleGithubProfileRequest } from '../../server/api/github';
import { handleGeminiDecisionRequest } from '../../server/api/gemini';
import { PRODUCTION_CSP } from '../../server/lib/http';
import { createRequest, createResponse, responseOf } from './helpers';

vi.mock('../../server/api/github', () => ({
  handleGithubProfileRequest: vi.fn(async () => {}),
}));

vi.mock('../../server/api/gemini', () => ({
  handleGeminiDecisionRequest: vi.fn(async () => {}),
}));

const onGithub = vi.mocked(handleGithubProfileRequest);
const onGemini = vi.mocked(handleGeminiDecisionRequest);

beforeEach(() => {
  vi.clearAllMocks();
});

function callMiddleware(
  url: string,
  options: { method?: string; withCsp?: boolean } = {}
) {
  const req = createRequest({
    method: options.method ?? 'GET',
    url,
    headers: { host: 'localhost:3000' },
  });
  const res = createResponse();
  const next = vi.fn();
  const middleware = createApiMiddleware({ withCsp: options.withCsp });

  return { req, res, next, middleware };
}

describe('createApiMiddleware — routing', () => {
  it('applies baseline security headers to every request', async () => {
    const { req, res, next, middleware } = callMiddleware('/index.html');

    await middleware(req, res, next);

    const mock = responseOf(res);
    expect(mock.getHeader('x-content-type-options')).toBe('nosniff');
    expect(mock.getHeader('x-frame-options')).toBe('DENY');
    expect(mock.getHeader('referrer-policy')).toBe('strict-origin-when-cross-origin');
    expect(next).toHaveBeenCalledWith();
  });

  it('adds the CSP only for the preview/production middleware', async () => {
    const plain = callMiddleware('/');
    await plain.middleware(plain.req, plain.res, plain.next);
    expect(responseOf(plain.res).getHeader('content-security-policy')).toBeUndefined();

    const hardened = callMiddleware('/', { withCsp: true });
    await hardened.middleware(hardened.req, hardened.res, hardened.next);
    expect(responseOf(hardened.res).getHeader('content-security-policy')).toBe(PRODUCTION_CSP);
  });

  it('routes the GitHub proxy and strips the query string', async () => {
    const { req, res, next, middleware } = callMiddleware('/api/github/ada?foo=bar');

    await middleware(req, res, next);

    expect(onGithub).toHaveBeenCalledWith(req, res, 'ada');
    expect(next).not.toHaveBeenCalled();
  });

  it('routes encoded GitHub usernames without decoding twice', async () => {
    const { req, res, next, middleware } = callMiddleware('/api/github/ada%2Dlovelace');

    await middleware(req, res, next);

    expect(onGithub).toHaveBeenCalledWith(req, res, 'ada%2Dlovelace');
  });

  it('routes the Gemini decision endpoint', async () => {
    const { req, res, next, middleware } = callMiddleware('/api/gemini/decisions', {
      method: 'POST',
    });

    await middleware(req, res, next);

    expect(onGemini).toHaveBeenCalledWith(req, res);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 404 for unknown API routes', async () => {
    const { req, res, next, middleware } = callMiddleware('/api/unknown');

    await middleware(req, res, next);

    expect(responseOf(res).statusCode).toBe(404);
    expect(responseOf(res).json()).toEqual({ error: 'Unknown API route.' });
    expect(next).not.toHaveBeenCalled();
  });

  it('does not intercept paths that merely contain /api/', async () => {
    const { req, res, next, middleware } = callMiddleware('/docs/api/reference');

    await middleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(responseOf(res).statusCode).toBe(200);
  });
});

describe('createApiMiddleware — failures', () => {
  it('returns a 500 when a handler throws', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    onGithub.mockRejectedValueOnce(new Error('boom'));
    const { req, res, next, middleware } = callMiddleware('/api/github/ada');

    await middleware(req, res, next);

    expect(responseOf(res).statusCode).toBe(500);
    expect(responseOf(res).json()).toEqual({ error: 'Unexpected server error.' });
    expect(next).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
  });
});

describe('gitPolisApiPlugin', () => {
  it('registers the middleware for dev and preview', () => {
    const plugin = gitPolisApiPlugin();

    expect(plugin.name).toBe('gitpolis-api');

    const devUse = vi.fn();
    const previewUse = vi.fn();
    (plugin.configureServer as (server: unknown) => void)({ middlewares: { use: devUse } });
    (plugin.configurePreviewServer as (server: unknown) => void)({
      middlewares: { use: previewUse },
    });

    expect(devUse).toHaveBeenCalledTimes(1);
    expect(previewUse).toHaveBeenCalledTimes(1);
    expect(typeof devUse.mock.calls[0][0]).toBe('function');
    expect(typeof previewUse.mock.calls[0][0]).toBe('function');
  });
});
