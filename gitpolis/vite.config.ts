import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { gitPolisApiPlugin } from './server/plugin';

/**
 * Network binding is opt-in.
 *
 * By default the dev server only listens on localhost and only accepts
 * localhost Host headers — a blanket `host: 0.0.0.0` + `allowedHosts: true`
 * combination is a DNS-rebinding footgun. Set GITPOLIS_LAN=1 to expose the
 * server to your local network deliberately.
 */
export default defineConfig(({ mode }) => {
  // Vite loads .env into `import.meta.env` for the client, but the API
  // middleware runs in Node and reads `process.env`. Copy file values across
  // without overriding variables already set by the shell or CI.
  const fileEnv = loadEnv(mode, process.cwd(), '');
  for (const [key, value] of Object.entries(fileEnv)) {
    if (process.env[key] === undefined) process.env[key] = value;
  }

  const allowLan = process.env.GITPOLIS_LAN === '1';
  const extraAllowedHosts = (process.env.GITPOLIS_ALLOWED_HOSTS || '')
    .split(',')
    .map((host) => host.trim())
    .filter(Boolean);

  return {
    plugins: [react(), tailwindcss(), gitPolisApiPlugin()],
    server: {
      host: allowLan ? '0.0.0.0' : 'localhost',
      port: Number(process.env.PORT) || 5173,
      allowedHosts: allowLan ? true : extraAllowedHosts.length > 0 ? extraAllowedHosts : undefined,
    },
    preview: {
      host: allowLan ? '0.0.0.0' : 'localhost',
      port: Number(process.env.PREVIEW_PORT) || 4173,
      allowedHosts: extraAllowedHosts.length > 0 ? extraAllowedHosts : undefined,
    },
    build: {
      target: 'es2022',
      sourcemap: false,
      rollupOptions: {
        output: {
          // Split the heavy, rarely-changing libraries so app code can be
          // re-deployed without invalidating the Three.js chunk.
          manualChunks: {
            three: ['three'],
            react: ['react', 'react-dom'],
          },
        },
      },
    },
  };
});
