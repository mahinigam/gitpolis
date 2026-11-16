import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.resolve(__dirname, '..');

async function run() {
  const geminiEntry = path.join(root, 'server/vercel/gemini/decisions.ts');
  const githubEntry = path.join(root, 'server/vercel/github/[username].ts');

  const geminiOut = path.join(root, 'api/gemini/decisions.js');
  const githubOut = path.join(root, 'api/github/[username].js');

  // Clean old .ts files in api/ to avoid Vercel trying to transpile raw TypeScript
  for (const tsFile of [
    path.join(root, 'api/gemini/decisions.ts'),
    path.join(root, 'api/github/[username].ts'),
  ]) {
    if (fs.existsSync(tsFile)) {
      fs.unlinkSync(tsFile);
    }
  }

  // Ensure output directories exist
  fs.mkdirSync(path.dirname(geminiOut), { recursive: true });
  fs.mkdirSync(path.dirname(githubOut), { recursive: true });

  await build({
    entryPoints: [geminiEntry],
    outfile: geminiOut,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    minify: false,
  });

  await build({
    entryPoints: [githubEntry],
    outfile: githubOut,
    bundle: true,
    platform: 'node',
    format: 'esm',
    target: 'node20',
    sourcemap: false,
    minify: false,
  });

  console.log('✓ Vercel serverless functions bundled to api/**/*.js successfully.');
}

run().catch((err) => {
  console.error('Failed to bundle serverless functions:', err);
  process.exit(1);
});
