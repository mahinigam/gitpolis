import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  GeminiServiceError,
  isProfilePayload,
  requestMunicipalPlan,
  resolveGeminiKey,
} from '../services/gemini';
import { getClientIp, isCrossOrigin, isMethod, readJsonBody, sendJson } from '../lib/http';
import { FixedWindowRateLimiter } from '../lib/rateLimit';

/** AI plans are expensive; 10 per minute per IP is plenty for interactive use. */
const limiter = new FixedWindowRateLimiter(10, 60_000);

const MAX_KEY_LENGTH = 256;

/**
 * `POST /api/gemini/decisions`
 *
 * Same-origin proxy for the Gemini Decision API. Preferring this route keeps
 * the API key on the server and out of URLs, browser history, and analytics.
 */
export async function handleGeminiDecisionRequest(
  req: IncomingMessage,
  res: ServerResponse
): Promise<void> {
  if (!isMethod(req, 'POST')) {
    sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'POST' });
    return;
  }
  if (isCrossOrigin(req)) {
    sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    return;
  }

  const limit = limiter.check(`gemini:${getClientIp(req)}`);
  if (!limit.allowed) {
    sendJson(
      res,
      429,
      { error: 'Too many AI plan requests. Please wait a moment.', rateLimited: true },
      { 'Retry-After': String(limit.retryAfterSeconds) }
    );
    return;
  }

  // The prompt is compacted before sending, so anything near the global cap
  // is abusive; 192 KB is ~4x a legitimate payload.
  const body = await readJsonBody(req, 192 * 1024);
  if (!body.ok) {
    sendJson(res, body.status, { error: body.error });
    return;
  }

  const payload = (body.body as { payload?: unknown } | undefined)?.payload;
  if (!isProfilePayload(payload)) {
    sendJson(res, 400, { error: 'Request body must include a valid GitHub profile payload.' });
    return;
  }

  const keyHeader = req.headers['x-gemini-key'];
  const clientKey = Array.isArray(keyHeader) ? keyHeader[0] : keyHeader;
  if (typeof clientKey === 'string' && clientKey.length > MAX_KEY_LENGTH) {
    sendJson(res, 400, { error: 'Gemini API key is malformed.' });
    return;
  }

  const apiKey = resolveGeminiKey(typeof clientKey === 'string' ? clientKey : undefined);
  if (!apiKey) {
    sendJson(res, 503, {
      error:
        'No Gemini API key configured. Set GEMINI_API_KEY on the server or supply a key in the app.',
    });
    return;
  }

  try {
    const plan = await requestMunicipalPlan(payload, apiKey);
    sendJson(res, 200, { plan });
  } catch (err) {
    if (err instanceof GeminiServiceError) {
      sendJson(res, err.status, { error: err.message });
      return;
    }
    console.error('[GitPolis Gemini Error]', err);
    sendJson(res, 502, { error: 'Unexpected error contacting the Gemini Decision API.' });
  }
}
