import { afterEach, describe, expect, it } from 'vitest';
import type { IncomingMessage } from 'node:http';
import {
  BASE_SECURITY_HEADERS,
  PRODUCTION_CSP,
  getClientIp,
  isCrossOrigin,
  isMethod,
  readJsonBody,
  sendJson,
} from '../../../server/lib/http';
import { createOpenRequest, createRequest, createResponse, responseOf } from '../helpers';

const originalTrustProxy = process.env.GITPOLIS_TRUST_PROXY;

afterEach(() => {
  if (originalTrustProxy === undefined) delete process.env.GITPOLIS_TRUST_PROXY;
  else process.env.GITPOLIS_TRUST_PROXY = originalTrustProxy;
});

describe('sendJson', () => {
  it('writes a JSON payload with defensive headers', () => {
    const res = createResponse();
    sendJson(res, 201, { ok: true });

    const mock = responseOf(res);
    expect(mock.statusCode).toBe(201);
    expect(mock.getHeader('content-type')).toBe('application/json; charset=utf-8');
    expect(mock.getHeader('cache-control')).toBe('no-store');
    expect(mock.getHeader('x-content-type-options')).toBe('nosniff');
    expect(mock.getHeader('referrer-policy')).toBe('no-referrer');
    expect(mock.json()).toEqual({ ok: true });
    expect(mock.writableEnded).toBe(true);
  });

  it('merges caller-provided headers', () => {
    const res = createResponse();
    sendJson(res, 429, { error: 'slow down' }, { 'Retry-After': '12' });

    expect(responseOf(res).getHeader('retry-after')).toBe('12');
  });

  it('does nothing once the response has ended', () => {
    const res = createResponse();
    sendJson(res, 200, { first: true });
    sendJson(res, 500, { second: true });

    const mock = responseOf(res);
    expect(mock.statusCode).toBe(200);
    expect(mock.json()).toEqual({ first: true });
  });
});

describe('readJsonBody', () => {
  const jsonHeaders = { 'content-type': 'application/json' };

  it('parses a JSON object', async () => {
    const req = createRequest({ headers: jsonHeaders, body: '{"payload":{"a":1}}' });

    await expect(readJsonBody(req)).resolves.toEqual({
      ok: true,
      status: 200,
      body: { payload: { a: 1 } },
    });
  });

  it('accepts a charset suffix and mixed case', async () => {
    const req = createRequest({
      headers: { 'content-type': 'Application/JSON; charset=utf-8' },
      body: '{"ok":true}',
    });

    await expect(readJsonBody(req)).resolves.toMatchObject({ ok: true, body: { ok: true } });
  });

  it('treats an empty body as an empty object', async () => {
    const req = createRequest({ headers: jsonHeaders, body: '' });

    await expect(readJsonBody(req)).resolves.toEqual({ ok: true, status: 200, body: {} });
  });

  it('rejects a non-JSON content type without reading the body', async () => {
    const req = createRequest({ headers: { 'content-type': 'text/plain' }, body: 'hello' });

    await expect(readJsonBody(req)).resolves.toEqual({
      ok: false,
      status: 415,
      error: 'Expected application/json.',
    });
  });

  it('rejects a missing content type', async () => {
    const req = createRequest({ body: '{"ok":true}' });

    await expect(readJsonBody(req)).resolves.toMatchObject({ ok: false, status: 415 });
  });

  it('rejects malformed JSON', async () => {
    const req = createRequest({ headers: jsonHeaders, body: '{"oops":' });

    await expect(readJsonBody(req)).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'Malformed JSON body.',
    });
  });

  it('rejects a body over the byte cap and pauses the stream', async () => {
    const req = createRequest({ headers: jsonHeaders, body: 'x'.repeat(64) });

    await expect(readJsonBody(req, 16)).resolves.toEqual({
      ok: false,
      status: 413,
      error: 'Request body too large.',
    });
    expect((req as IncomingMessage & { isPaused: () => boolean }).isPaused()).toBe(true);
  });

  it('accepts a body exactly at the cap', async () => {
    const body = JSON.stringify({ value: '1234' });
    const req = createRequest({ headers: jsonHeaders, body });

    await expect(readJsonBody(req, Buffer.byteLength(body))).resolves.toMatchObject({ ok: true });
  });

  it('reports a request stream error', async () => {
    const req = createOpenRequest({ headers: jsonHeaders });
    const result = readJsonBody(req);
    req.emit('error', new Error('socket hang up'));

    await expect(result).resolves.toEqual({
      ok: false,
      status: 400,
      error: 'Request stream error.',
    });
  });
});

describe('isMethod', () => {
  it('defaults to GET when no method is set', () => {
    const req = { headers: {} } as IncomingMessage;

    expect(isMethod(req, 'GET')).toBe(true);
    expect(isMethod(req, 'POST')).toBe(false);
  });

  it('compares case-insensitively', () => {
    expect(isMethod(createRequest({ method: 'post' }), 'POST')).toBe(true);
    expect(isMethod(createRequest({ method: 'Get' }), 'GET')).toBe(true);
  });
});

describe('isCrossOrigin', () => {
  it('allows requests without an Origin header', () => {
    expect(isCrossOrigin(createRequest({ headers: { host: 'localhost:5173' } }))).toBe(false);
  });

  it('allows a same-origin request', () => {
    const req = createRequest({
      headers: { host: 'localhost:5173', origin: 'http://localhost:5173' },
    });

    expect(isCrossOrigin(req)).toBe(false);
  });

  it('rejects a different origin', () => {
    const req = createRequest({
      headers: { host: 'localhost:5173', origin: 'https://evil.example' },
    });

    expect(isCrossOrigin(req)).toBe(true);
  });

  it('rejects an unparseable Origin value', () => {
    expect(isCrossOrigin(createRequest({ headers: { origin: 'not a url' } }))).toBe(true);
  });

  it('honours x-forwarded-host only when the proxy is trusted', () => {
    const headers = {
      host: 'internal:3000',
      'x-forwarded-host': 'gitpolis.example',
      origin: 'https://gitpolis.example',
    };

    delete process.env.GITPOLIS_TRUST_PROXY;
    expect(isCrossOrigin(createRequest({ headers }))).toBe(true);

    process.env.GITPOLIS_TRUST_PROXY = '1';
    expect(isCrossOrigin(createRequest({ headers }))).toBe(false);
  });

  it('ignores x-forwarded-host when it is absent even behind a proxy', () => {
    process.env.GITPOLIS_TRUST_PROXY = '1';
    const req = createRequest({
      headers: { host: 'gitpolis.example', origin: 'https://gitpolis.example' },
    });

    expect(isCrossOrigin(req)).toBe(false);
  });
});

describe('getClientIp', () => {
  it('uses the socket address by default', () => {
    const req = createRequest({
      headers: { 'x-forwarded-for': '1.2.3.4' },
      remoteAddress: '10.0.0.7',
    });

    delete process.env.GITPOLIS_TRUST_PROXY;
    expect(getClientIp(req)).toBe('10.0.0.7');
  });

  it('uses the last forwarded hop when the proxy is trusted', () => {
    process.env.GITPOLIS_TRUST_PROXY = '1';
    const req = createRequest({
      headers: { 'x-forwarded-for': '203.0.113.9, 10.0.0.7' },
      remoteAddress: '127.0.0.1',
    });

    expect(getClientIp(req)).toBe('10.0.0.7');
  });

  it('trims and drops empty forwarded hops', () => {
    process.env.GITPOLIS_TRUST_PROXY = '1';
    const req = createRequest({
      headers: { 'x-forwarded-for': ' , 198.51.100.4 , ' },
    });

    expect(getClientIp(req)).toBe('198.51.100.4');
  });

  it('falls back to the socket when the forwarded header is empty', () => {
    process.env.GITPOLIS_TRUST_PROXY = '1';
    const req = createRequest({
      headers: { 'x-forwarded-for': '   ' },
      remoteAddress: '10.0.0.9',
    });

    expect(getClientIp(req)).toBe('10.0.0.9');
  });

  it('falls back to "unknown" without a socket address', () => {
    const req = createRequest();
    delete (req as { socket?: unknown }).socket;

    expect(getClientIp(req)).toBe('unknown');
  });
});

describe('security header constants', () => {
  it('sets baseline headers', () => {
    expect(BASE_SECURITY_HEADERS).toMatchObject({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
    });
    expect(BASE_SECURITY_HEADERS['Permissions-Policy']).toContain('geolocation=()');
  });

  it('locks down the production CSP', () => {
    expect(PRODUCTION_CSP).toContain("default-src 'self'");
    expect(PRODUCTION_CSP).toContain("frame-ancestors 'none'");
    expect(PRODUCTION_CSP).toContain("base-uri 'self'");
    expect(PRODUCTION_CSP).toContain("form-action 'self'");
    expect(PRODUCTION_CSP).toContain('https://api.github.com');
    expect(PRODUCTION_CSP).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
