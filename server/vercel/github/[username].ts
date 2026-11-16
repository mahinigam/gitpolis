import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGithubProfileRequest } from '../../api/github';
import { BASE_SECURITY_HEADERS } from '../../lib/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    const query = (req as { query?: Record<string, string | string[]> }).query || {};
    const rawUsername = Array.isArray(query.username) ? query.username[0] : query.username || '';
    await handleGithubProfileRequest(req, res, rawUsername);
  } catch (err) {
    console.error('[Vercel Serverless GitHub Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Serverless GitHub request failed',
        })
      );
    }
  }
}
