import type { IncomingMessage, ServerResponse } from 'node:http';
import { fetchGitHubProfileForCity, GitHubServiceError } from '../services/github';
import { getClientIp, isCrossOrigin, isMethod, sendJson } from '../lib/http';
import { FixedWindowRateLimiter } from '../lib/rateLimit';

/** 30 profile builds per minute per IP is generous for humans, hostile to scrapers. */
const limiter = new FixedWindowRateLimiter(30, 60_000);

const MAX_TOKEN_LENGTH = 512;
const MAX_USERNAME_LENGTH = 39;

/**
 * `GET /api/github/:username`
 *
 * Server-side proxy for the GitHub REST API. Caches responses for 15 minutes
 * and shares an optional server token, so anonymous rate limits are not
 * consumed per visitor.
 */
export async function handleGithubProfileRequest(
  req: IncomingMessage,
  res: ServerResponse,
  rawUsername: string
): Promise<void> {
  if (!isMethod(req, 'GET')) {
    sendJson(res, 405, { error: 'Method not allowed.' }, { Allow: 'GET' });
    return;
  }
  if (isCrossOrigin(req)) {
    sendJson(res, 403, { error: 'Cross-origin requests are not allowed.' });
    return;
  }

  const limit = limiter.check(`github:${getClientIp(req)}`);
  if (!limit.allowed) {
    sendJson(
      res,
      429,
      { error: 'Too many requests. Please slow down.', rateLimited: true },
      { 'Retry-After': String(limit.retryAfterSeconds) }
    );
    return;
  }

  const username = (() => {
    try {
      return decodeURIComponent(rawUsername || '').trim();
    } catch {
      return null;
    }
  })();
  if (username === null) {
    sendJson(res, 400, { error: 'GitHub username contains invalid characters.' });
    return;
  }
  if (!username) {
    sendJson(res, 400, { error: 'Missing GitHub username.' });
    return;
  }
  if (username.length > MAX_USERNAME_LENGTH) {
    sendJson(res, 400, { error: 'GitHub username is too long.' });
    return;
  }

  const tokenHeader = req.headers['x-github-token'];
  const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;
  if (typeof token === 'string' && token.length > MAX_TOKEN_LENGTH) {
    sendJson(res, 400, { error: 'GitHub token is malformed.' });
    return;
  }

  try {
    const payload = await fetchGitHubProfileForCity(username, token);
    sendJson(res, 200, payload);
  } catch (err) {
    if (err instanceof GitHubServiceError) {
      sendJson(res, err.status, {
        error: err.message,
        rateLimited: err.rateLimited,
        resetAt: err.resetAt,
      });
      return;
    }
    console.error('[GitPolis API Error]', err);
    sendJson(res, 500, { error: 'Unexpected server error fetching GitHub profile.' });
  }
}
