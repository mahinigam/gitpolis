# GitPolis

GitPolis turns a GitHub profile into an interactive 3D city. Repositories become districts, languages choose architectural styles, commit history shapes individual buildings, and profile activity drives the climate and skyline. The result is deterministic: the same profile and the same clock produce the same city.

The app is a React + Three.js SPA with a small Node API layer embedded in the Vite dev/preview server. It can run fully locally, and it degrades to direct browser calls when deployed as static files.

## Requirements

- Node.js 22 or newer (CI runs on 22)
- npm 10 or newer
- A WebGL-capable browser for the 3D view

## Quick start

```bash
git clone <repository-url> GitPolis
cd GitPolis
npm install
cp .env.example .env   # optional; all values have defaults
npm run dev
```

Open <http://localhost:5173>. Add `?user=<login>` to load a profile immediately, for example `http://localhost:5173/?user=torvalds`.

`npm run dev` serves both the SPA and the `/api/*` routes. The API layer only exists in the Vite server and in `npm run preview`; a plain static deployment does not get it (see [Deployment](#deployment)).

## Scripts

Run these from the repository root.

| Command | Purpose |
| --- | --- |
| `npm install` | Install dependencies |
| `npm run dev` | Start Vite with the GitHub/Gemini proxy |
| `npm run build` | Type-check and build `dist` |
| `npm run preview` | Serve the production build with the proxy and CSP |
| `npm run test` | Run the Vitest suite once |
| `npm run test:coverage` | Run tests with V8 coverage and thresholds |
| `npm run test:gemini:live` | Validate a real Gemini plan against the configured key |
| `npm run lint` | ESLint over app, server, and tests |
| `npm run typecheck` | Build the app plus `--noEmit` for tests |
| `npm run format` | Format with Prettier |

`npm run test:watch` starts Vitest in watch mode.

## Configuration

Copy `.env.example` to `.env`. Vite loads the file and forwards values to the API middleware without overriding variables already set by the shell or CI.

| Variable | Scope | Default | Notes |
| --- | --- | --- | --- |
| `GITHUB_TOKEN` | server | unset | Raises the GitHub budget to 5,000 req/hr and enables deeper analysis. Never sent to the browser. |
| `GEMINI_API_KEY` | server | unset | Lets visitors use AI plans without supplying a key. |
| `GEMINI_MODEL` | server | `gemini-3.5-flash` | Model used by the Gemini proxy. Falls back to `gemini-3-flash-preview`, then `gemini-2.5-flash`. |
| `VITE_GEMINI_MODEL` | client build | `gemini-3.5-flash` | Model for the direct browser fallback. Rebuild after changing it. |
| `PORT` | dev server | `5173` | |
| `PREVIEW_PORT` | preview server | `4173` | |
| `GITPOLIS_LAN` | dev/preview | unset | `1` binds to `0.0.0.0`; leave unset for localhost. |
| `GITPOLIS_ALLOWED_HOSTS` | dev/preview | unset | Comma-separated extra `Host` values, e.g. a tunnel domain. |
| `GITPOLIS_TRUST_PROXY` | server | unset | `1` enables `X-Forwarded-For` (last hop) and `X-Forwarded-Host`. Set only behind a proxy you control. |

Anything prefixed with `VITE_` is inlined into the public bundle. Do not put secrets there.

## How it works

1. **Input.** The app starts with an empty state. Searching for a username fetches `GET /api/github/:username`; the showcase city can be loaded explicitly. If the proxy is unavailable, the client calls `api.github.com` directly.
2. **Normalisation.** Raw GitHub objects are mapped once in `src/domain/github/mapRepository.ts`. The server proxy and the browser fallback produce the same domain shape, including per-repo `commitsSource` and profile `source`.
3. **Blueprint.** `buildCityBlueprint(payload, { nowMs })` is pure and deterministic. It ranks repositories, assigns districts and zones, derives prosperity/fulfilment metrics, picks climate, and lays out the timeline. The seed comes from the login; randomness is precomputed before sorting.
4. **Render.** `CityScene` builds geometry from the blueprint. Language styles live in `domain/city/styles.ts`; building, environment, and life systems live under `engine/`.
5. **AI plan (optional).** The client asks `POST /api/gemini/decisions`, or calls Gemini directly with a visitor-supplied key. Responses are validated against a shared schema and cached by profile fingerprint.

## Architecture

```
GitPolis/
├── .github/workflows/ci.yml        # lint → typecheck → coverage → build
├── .env.example                    # server and build-time configuration
├── package.json
├── index.html
├── src/
│   ├── app/                        # App shell and hooks
│   │   └── hooks/                  # engine lifecycle, timeline, climate
│   ├── components/                 # hud/, panels/, modals/
│   ├── data/                       # showcase profiles
│   ├── domain/                     # framework-free business logic
│   │   ├── city/                   # blueprint, planning, analysis, climate, naming, styles
│   │   ├── decision/               # plan contract, Gemini schema, prompt, validation
│   │   └── github/                 # raw mapping, metrics, commit classifier, fingerprint
│   ├── engine/                     # Three.js scene and builders
│   │   ├── builders/               # buildings, environment, municipal decor
│   │   ├── materials/              # procedural textures
│   │   └── systems/                # commuter/ambient life
│   ├── services/                   # browser transports
│   │   ├── github/                 # proxy-first profile client
│   │   └── gemini/                 # proxy-first client, cache, key storage
│   ├── styles/
│   └── main.tsx
├── server/                         # Vite middleware API
│   ├── api/                        # HTTP handlers
│   ├── lib/                        # http, cache, rate limit, concurrency
│   ├── services/                   # GitHub and Gemini orchestration
│   └── plugin.ts                   # Connect middleware + Vite plugin
├── tests/
│   ├── app/hooks/
│   ├── domain/
│   ├── fixtures/
│   ├── server/
│   └── services/
├── public/_headers                 # static-host headers (Netlify/Cloudflare Pages)
├── vite.config.ts
└── vitest.config.ts
```

Dependency direction is one-way: `app`/`components` → `services` → `domain`; `engine` depends on `domain` types and styles. `domain/` has no React, Three.js, network, or storage dependencies, which keeps it directly testable.

### Design decisions

- **One mapping layer.** Server and browser must not drift, so both call `mapRawRepository`/`mapRawUser` rather than reimplementing GitHub shape conversions.
- **Determinism over random visuals.** Blueprint generation takes an injectable clock and precomputes jitter before sorting. Snapshot-style tests can compare two builds exactly.
- **Provenance is data, not decoration.** `source` is `live`, `mixed`, or `showcase`; each repo carries `commitsSource` (`api`, `events`, `synthetic`). The UI badge distinguishes all three. Synthetic timelines are visual fallbacks and are never passed off as real history.
- **Two Gemini transports, one contract.** The proxy is preferred so the key can stay server-side; the direct path keeps static deployments usable. Both use the same schema and validator.
- **No premature provider abstraction.** There is one decision provider. A provider interface would add indirection without a second implementation.

## API

Both routes are same-origin only. CORS headers are never emitted; cross-origin requests with an `Origin` header are rejected.

### `GET /api/github/:username`

Fetches a profile, repositories, activity, and bounded deep analytics.

- Optional header: `x-github-token` (max 512 chars). Falls back to `GITHUB_TOKEN`.
- Anonymous responses are cached for 15 minutes and concurrent anonymous requests are de-duplicated.
- Token-authenticated responses are never cached, because a token can expose private repositories.
- Rate limit: 30 requests/minute/IP.
- Errors: `400` invalid username/token, `404` unknown user, `429` GitHub rate limit (with `rateLimited` and `resetAt`), `500` unexpected.

### `POST /api/gemini/decisions`

Body: `{ "payload": <GitHubProfilePayload> }` (max 192 KB).

- Optional header: `x-gemini-key` (max 256 chars). A server `GEMINI_API_KEY` takes precedence.
- Returns `{ "plan": MunicipalDecisionPlan }`.
- Rate limit: 10 requests/minute/IP.
- Errors: `400` invalid body/key, `413` oversized body, `415` wrong content type, `429` limit reached, `502` upstream failure, `503` no key configured.

The in-process limiter and cache are adequate for a single dev/preview instance. A multi-instance deployment should replace them with a shared store (Redis, Cloudflare KV/Durable Objects).

## Data provenance

| Field | Values | Meaning |
| --- | --- | --- |
| `payload.source` | `live` | Profile and repository data came from the GitHub API |
| | `mixed` | Profile/repository data is live; some commit history was estimated |
| | `showcase` | Bundled sample data, no network call |
| `repo.commitsSource` | `api` | Commits fetched from the repository commits endpoint |
| | `events` | Commits reconstructed from the public events feed |
| | `synthetic` | Deterministic visual fallback derived from repo metadata |

`recentPushCount` is derived from push timestamps when the events feed is unavailable; it is not invented. When GitHub's anonymous budget is low, deep commit/language fetches are skipped by design rather than failing the whole build.

## Security model

- No secrets in the client bundle. Only `VITE_GEMINI_MODEL` is public.
- User-supplied Gemini keys are kept in `sessionStorage`, sent in headers (`x-goog-api-key` or `x-gemini-key`), and never placed in query strings.
- Server tokens are used only for `api.github.com`. Browser tokens are forwarded to the same-origin proxy and to GitHub; they are not sent anywhere else.
- Anonymous-only caching prevents one visitor's private repository data from being served to another.
- `X-Forwarded-For` is ignored unless `GITPOLIS_TRUST_PROXY=1`; when enabled, only the last hop is trusted. The origin check similarly uses `X-Forwarded-Host` only behind a trusted proxy.
- Responses include `X-Content-Type-Options`, `X-Frame-Options: DENY`, `Referrer-Policy`, and `Permissions-Policy`. The production/preview response adds a CSP that allows only self-hosted scripts, GitHub avatars, and the two upstream APIs.
- Bodies, usernames, tokens, prompts, fan-out concurrency, and retries are all bounded.

## Testing

```bash
npm run test            # 403 tests
npm run test:coverage   # V8 coverage with thresholds
```

Coverage currently sits at roughly 94% statements and 84% branches. The configured floors are 80% statements/lines/functions and 70% branches. Tests are behavioural and organised by layer:

- `tests/domain/` — deterministic blueprint planning, metrics, naming, commit classification, fingerprints, schema validation, prompt truncation
- `tests/services/` — GitHub proxy-first client and fallback, Gemini transport selection, retries, caching, key storage
- `tests/server/` — HTTP helpers, TTL cache, rate limiter, concurrency, both API handlers, middleware routing, upstream orchestration and cache isolation
- `tests/app/hooks/` — engine lifecycle, timeline playback, climate controls

CI runs `lint`, `typecheck`, `test:coverage`, and `build` on every push to `main` and every pull request.

## Build and deployment

```bash
npm run build     # emits dist
npm run preview   # serves the build with API routes and CSP
```

`public/_headers` contains headers in Netlify/Cloudflare Pages format. It mirrors `PRODUCTION_CSP` in `server/lib/http.ts`; update both when the CSP changes.

Two deployment modes are supported:

- **Node/Vite server (full functionality).** Keep the middleware from `server/plugin.ts` and set `GITHUB_TOKEN`/`GEMINI_API_KEY` as server environment variables. This is the only mode where visitors need no keys.
- **Static hosting (reduced functionality).** A static host has no `/api/*` routes. The client falls back to the public GitHub API and to direct Gemini calls, so AI plans require each visitor to supply a key. The static host still gets the headers from `public/_headers`.

The app has no authentication or user accounts. Rate limits and caches reset when the server restarts.

## Known limitations

- Repo ranking and district assignment are heuristics, not a learned model.
- Anonymous GitHub access is limited to 60 requests/hour; deep analysis is budget-aware and partial by design.
- When commits cannot be fetched, the skyline uses labelled synthetic history.
- AI plan quality depends on the configured Gemini model; validation clamps values and fills defaults, so malformed output degrades rather than crashes.
- The in-process cache and rate limiter are single-instance only.

## License

GitPolis is licensed under the [MIT License](./LICENSE).

This license covers the code in this repository. GitHub, Gemini, Three.js,
React, and other third-party services and dependencies remain subject to their
own licenses and terms.
