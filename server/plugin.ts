import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Plugin } from 'vite';
import { handleGeminiDecisionRequest } from './api/gemini';
import { handleGithubProfileRequest } from './api/github';
import { BASE_SECURITY_HEADERS, PRODUCTION_CSP, sendJson } from './lib/http';

const GITHUB_PREFIX = '/api/github/';
const GEMINI_ROUTE = '/api/gemini/decisions';

type Next = (err?: unknown) => void;

function pathnameOf(req: IncomingMessage): string {
  return (req.url || '/').split('?')[0];
}

/**
 * Connect/Express-style middleware that owns every `/api/*` route.
 *
 * Security headers are applied to *all* responses, including Vite's own
 * assets, because they are set before delegating to `next()`.
 */
export function createApiMiddleware(options: { withCsp?: boolean } = {}) {
  return async (req: IncomingMessage, res: ServerResponse, next: Next): Promise<void> => {
    for (const [key, value] of Object.entries(BASE_SECURITY_HEADERS)) {
      res.setHeader(key, value);
    }
    if (options.withCsp) res.setHeader('Content-Security-Policy', PRODUCTION_CSP);

    const pathname = pathnameOf(req);

    try {
      if (pathname.startsWith(GITHUB_PREFIX)) {
        await handleGithubProfileRequest(req, res, pathname.slice(GITHUB_PREFIX.length));
        return;
      }
      if (pathname === GEMINI_ROUTE) {
        await handleGeminiDecisionRequest(req, res);
        return;
      }
      if (pathname.startsWith('/api/')) {
        sendJson(res, 404, { error: 'Unknown API route.' });
        return;
      }
    } catch (err) {
      console.error('[GitPolis Middleware Error]', err);
      sendJson(res, 500, { error: 'Unexpected server error.' });
      return;
    }

    next();
  };
}

/**
 * Vite plugin exposing the GitHub and Gemini proxies during `vite dev` and
 * `vite preview`. Kept as a plugin (rather than a standalone Express server)
 * so a single process serves both the SPA and the API.
 */
export function gitPolisApiPlugin(): Plugin {
  return {
    name: 'gitpolis-api',
    configureServer(server) {
      server.middlewares.use(createApiMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createApiMiddleware({ withCsp: true }));
    },
  };
}
