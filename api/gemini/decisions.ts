import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGeminiDecisionRequest } from '../../server/api/gemini';
import { BASE_SECURITY_HEADERS } from '../../server/lib/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
    res.setHeader(key, value);
  }
  await handleGeminiDecisionRequest(req, res);
}
