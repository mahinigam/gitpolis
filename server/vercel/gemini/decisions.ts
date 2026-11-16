import type { IncomingMessage, ServerResponse } from 'node:http';
import { handleGeminiDecisionRequest } from '../../api/gemini';
import { BASE_SECURITY_HEADERS } from '../../lib/http';

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  try {
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    await handleGeminiDecisionRequest(req, res);
  } catch (err) {
    console.error('[Vercel Serverless Function Error]', err);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.end(
        JSON.stringify({
          error: err instanceof Error ? err.message : 'Serverless function execution failed',
        })
      );
    }
  }
}
