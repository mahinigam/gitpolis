import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fetchGitHubProfileForCity, GitHubServiceError } from './server/githubService';

function createGithubMiddleware() {
  return async (req: any, res: any, next: any) => {
    if (!req.url || !req.url.startsWith('/api/github/')) {
      return next();
    }

    const urlObj = new URL(req.url, 'http://localhost');
    const pathParts = urlObj.pathname.replace(/^\/api\/github\//, '').split('/');
    const username = decodeURIComponent(pathParts[0] || '').trim();

    res.setHeader('Content-Type', 'application/json; charset=utf-8');

    if (!username) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: 'Missing GitHub username.' }));
      return;
    }

    const tokenHeader = req.headers['x-github-token'];
    const token = Array.isArray(tokenHeader) ? tokenHeader[0] : tokenHeader;

    try {
      const payload = await fetchGitHubProfileForCity(username, token);
      res.statusCode = 200;
      res.end(JSON.stringify(payload));
    } catch (err) {
      if (err instanceof GitHubServiceError) {
        res.statusCode = err.status;
        res.end(
          JSON.stringify({
            error: err.message,
            rateLimited: err.rateLimited,
            resetAt: err.resetAt,
          })
        );
        return;
      }
      console.error('[GitPolis API Error]', err);
      res.statusCode = 500;
      res.end(JSON.stringify({ error: 'Unexpected server error fetching GitHub profile.' }));
    }
  };
}

function githubApiPlugin(): Plugin {
  return {
    name: 'gitpolis-github-api',
    configureServer(server) {
      server.middlewares.use(createGithubMiddleware());
    },
    configurePreviewServer(server) {
      server.middlewares.use(createGithubMiddleware());
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), githubApiPlugin()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    cors: true,
  },
  preview: {
    host: '0.0.0.0',
    port: 4173,
    allowedHosts: true,
  },
});
