import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGithubProfileRequest } from '../../server/api/github';
import { BASE_SECURITY_HEADERS } from '../../server/lib/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
  const query = (req as { query?: Record<string, string | string[]> }).query || {};
  const rawUsername = Array.isArray(query.username) ? query.username[0] : query.username || '';
  await handleGithubProfileRequest(req, res, rawUsername);
}
