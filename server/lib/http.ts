import type { IncomingMessage, ServerResponse } from 'node:http';

const MAX_JSON_BYTES = 768 * 1024;

export interface JsonBodyResult {
  ok: boolean;
  status: number;
  body?: unknown;
  error?: string;
}

/** Writes a JSON response with defensive headers. */
export function sendJson(
  res: ServerResponse,
  status: number,
  payload: unknown,
  extraHeaders: Record<string, string> = {}
): void {
  if (res.writableEnded) return;
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'no-referrer');
  for (const [key, value] of Object.entries(extraHeaders)) res.setHeader(key, value);
  res.end(JSON.stringify(payload));
}

/**
 * Reads and parses a JSON request body with a hard size cap.
 * Returns a discriminated result instead of throwing so handlers stay flat.
 */
export function readJsonBody(req: IncomingMessage, maxBytes = MAX_JSON_BYTES): Promise<JsonBodyResult> {
  return new Promise((resolve) => {
    // If Vercel or another runtime already parsed the body into req.body
    const preParsed = (req as { body?: unknown }).body;
    if (preParsed !== undefined) {
      if (typeof preParsed === 'object' && preParsed !== null) {
        resolve({ ok: true, status: 200, body: preParsed });
        return;
      }
      if (typeof preParsed === 'string') {
        try {
          resolve({ ok: true, status: 200, body: JSON.parse(preParsed) });
          return;
        } catch {
          resolve({ ok: false, status: 400, error: 'Malformed JSON body.' });
          return;
        }
      }
    }

    const contentType = String(req.headers['content-type'] || '');
    if (!contentType.toLowerCase().includes('application/json')) {
      resolve({ ok: false, status: 415, error: 'Expected application/json.' });
      return;
    }

    let size = 0;
    let settled = false;
    const chunks: Buffer[] = [];

    req.on('data', (chunk: Buffer) => {
      if (settled) return;
      size += chunk.length;
      if (size > maxBytes) {
        settled = true;
        // Resolve first so the handler can send a real 413, then stop reading.
        resolve({ ok: false, status: 413, error: 'Request body too large.' });
        req.pause();
        return;
      }
      chunks.push(chunk);
    });

    req.on('end', () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve({ ok: true, status: 200, body: raw ? JSON.parse(raw) : {} });
      } catch {
        resolve({ ok: false, status: 400, error: 'Malformed JSON body.' });
      }
    });

    req.on('error', () => {
      if (!settled) resolve({ ok: false, status: 400, error: 'Request stream error.' });
    });
  });
}

/** True when the request method matches (case-insensitive). */
export function isMethod(req: IncomingMessage, method: string): boolean {
  return (req.method || 'GET').toUpperCase() === method;
}

/**
 * Blocks cross-origin callers that browsers flag with an `Origin` header.
 * Same-origin GETs often omit `Origin`, so a missing header is allowed.
 *
 * This is defence in depth, not the primary control: no CORS headers are
 * emitted, and `X-Forwarded-Host` is only honoured when explicitly trusted.
 */
export function isCrossOrigin(req: IncomingMessage): boolean {
  const origin = req.headers.origin;
  if (!origin) return false;
  try {
    const originHost = new URL(origin).host;
    const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === '1' || process.env.VERCEL === '1';
    const host = isTrustedProxy
      ? (req.headers['x-forwarded-host'] as string | undefined) || req.headers.host
      : req.headers.host;
    return originHost !== host;
  } catch {
    return true;
  }
}

/**
 * Client IP for rate limiting.
 *
 * `X-Forwarded-For` is client-controlled, so it is ignored unless the operator
 * explicitly declares a trusted proxy. Even then the *last* hop is used, which
 * is the one appended by that proxy.
 */
export function getClientIp(req: IncomingMessage): string {
  const isTrustedProxy = process.env.GITPOLIS_TRUST_PROXY === '1' || process.env.VERCEL === '1';
  if (isTrustedProxy) {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.length > 0) {
      const hops = forwarded.split(',').map((hop) => hop.trim()).filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1];
    }
  }
  return req.socket?.remoteAddress || 'unknown';
}

/** Headers applied to every dev/preview response. */
export const BASE_SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
};

/**
 * Content-Security-Policy for the built app (preview / production).
 * Dev mode is excluded because Vite's HMR client needs inline scripts.
 */
export const PRODUCTION_CSP = [
  "default-src 'self'",
  "script-src 'self' https://va.vercel-scripts.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: blob: https://avatars.githubusercontent.com https://raw.githubusercontent.com",
  "connect-src 'self' https://api.github.com https://generativelanguage.googleapis.com https://vitals.vercel-insights.com",
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');
