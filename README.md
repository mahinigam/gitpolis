# GitPolis

GitPolis turns any public GitHub profile into an interactive, procedural 3D metropolis. Repositories become municipal districts, programming languages dictate architectural design languages, commit histories extrude individual skyscrapers, and commit velocity drives real-time city weather and lighting.

The project is deterministic: the same profile and timestamp consistently produce the identical procedural city layout.

---

## Key Capabilities

* **Procedural 3D Metropolis**: Built with Three.js and WebGL. Each repository maps to a zoned city block with procedural geometries, window illumination, animated traffic, and ambient transit.
* **Deterministic Blueprint Engine**: Pure domain logic categorizes repositories into architectural domains, ranks skyline prominence, calculates prosperity/fulfillment metrics, and schedules historical timeline playback without external side effects.
* **Live GitHub Telemetry**: Ingests repository statistics, commit timestamps, release tags, and push events to derive developer vitality and atmospheric conditions (radiant daylight, morning mist, or electric rain showers).
* **Google Gemini AI Mayor Decision Engine**: Leverages `gemini-3.5-flash` with strict structured JSON schema outputs to synthesize civic titles, developer archetypes, zoned municipal districts, glowing inter-district transit networks (hyperloops, rails, ferries), commemorative epoch monuments, and atmospheric recommendations synchronized directly with the HUD.
* **Zero-Cost Serverless Deployment**: Self-contained Node 20 ESM serverless functions bundled with `esbuild` for Vercel, keeping `GEMINI_API_KEY` and `GITHUB_TOKEN` securely server-side with SPA route rewrites and Vercel Analytics integration.
* **Graceful Static Fallback**: When run without a server proxy, the client seamlessly degrades to direct GitHub API requests and client-supplied Google AI Studio keys stored safely in `sessionStorage`.

---

## Requirements

* **Node.js**: 20 or newer (tested on Node.js 22 in CI)
* **npm**: 10 or newer
* **Browser**: Any modern browser with WebGL hardware acceleration enabled

---

## Quick Start

```bash
git clone https://github.com/mahinigam/gitpolis.git
cd gitpolis
npm install
cp .env.example .env   # optional; defaults work out of the box
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Append `?user=<login>` to immediately load a profile (for example, `http://localhost:5173/?user=torvalds`).

In development, `npm run dev` serves both the Vite client application and the local API proxy endpoints.

---

## Scripts

All scripts are executed from the repository root:

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite development server with the embedded GitHub/Gemini API middleware |
| `npm run build` | Compiles TypeScript (`tsc -b`), builds client assets (`vite build`), and bundles standalone Vercel serverless functions (`node scripts/build-serverless.mjs`) |
| `npm run build:serverless` | Compiles standalone Node 20 ESM serverless functions into `api/**/*.js` |
| `npm run preview` | Serves the production build locally with production CSP and the local API proxy |
| `npm run test` | Runs the Vitest test suite once across all 26 test suites |
| `npm run test:watch` | Starts Vitest in interactive watch mode |
| `npm run test:coverage` | Runs test coverage with V8 instrumentation and enforced threshold checks |
| `npm run test:gemini:live` | Runs a real end-to-end Gemini plan synthesis using the configured API key |
| `npm run typecheck` | Validates TypeScript types across both application source and test fixtures |
| `npm run lint` | Runs ESLint across application code, serverless handlers, and test suites |
| `npm run lint:fix` | Automatically fixes autofixable ESLint violations |
| `npm run format` | Formats all source files using Prettier |
| `npm run format:check` | Verifies code formatting against Prettier rules |

---

## Configuration

Copy `.env.example` to `.env` to configure optional server secrets and model overrides.

| Variable | Scope | Default | Description |
| :--- | :--- | :--- | :--- |
| `GITHUB_TOKEN` | Server / Proxy | Unset | Personal GitHub token. Increases API rate limit from 60 to 5,000 requests/hour and enables deep commit analytics. Never exposed to the browser. |
| `GEMINI_API_KEY` | Server / Proxy | Unset | Google AI Studio API key. Enables the AI Mayor Decision Engine for all visitors without requiring them to supply their own key. |
| `GEMINI_MODEL` | Server / Proxy | `gemini-3.5-flash` | Primary Gemini model for the serverless proxy. Automatically falls back to `gemini-3-flash-preview` and `gemini-2.5-flash` if unavailable. |
| `VITE_GEMINI_MODEL` | Client Build | `gemini-3.5-flash` | Model identifier used only when making direct client-side fallback calls. |
| `PORT` | Dev Server | `5173` | Local development port. |
| `PREVIEW_PORT` | Preview Server | `4173` | Local production preview port. |
| `GITPOLIS_LAN` | Dev / Preview | Unset | Set to `1` to bind server to `0.0.0.0` for local network testing. |
| `GITPOLIS_ALLOWED_HOSTS`| Dev / Preview | Unset | Comma-separated list of additional permitted `Host` header values (e.g. reverse proxy or tunnel domains). |
| `GITPOLIS_TRUST_PROXY` | Server / Proxy | Unset | Set to `1` when running behind a trusted reverse proxy to respect `X-Forwarded-For` and `X-Forwarded-Host`. |

> **Security Note**: Variables prefixed with `VITE_` are embedded into public client bundles. Never prefix private tokens or API keys with `VITE_`.

---

## System Architecture

```
gitpolis/
├── api/                             # Standalone bundled Vercel serverless functions
│   ├── gemini/decisions.js          # Node 20 ESM bundle for /api/gemini/decisions
│   └── github/[username].js         # Node 20 ESM bundle for /api/github/:username
├── scripts/
│   ├── build-serverless.mjs         # esbuild script targeting standalone serverless output
│   └── test-gemini-live.ts          # Live integration verification script for Gemini API
├── server/                          # Server source code & local middleware
│   ├── api/                         # Node HTTP request handlers
│   ├── lib/                         # In-memory TTL cache, rate limiter, async concurrency, HTTP helpers
│   ├── services/                    # GitHub REST fetching and Gemini API orchestration
│   ├── vercel/                      # TypeScript entry points for Vercel serverless handlers
│   └── plugin.ts                    # Connect middleware plugin for Vite dev/preview
├── src/                             # Client application source (Vite + React + Three.js)
│   ├── app/                         # Application root, state, and lifecycle hooks
│   │   └── hooks/                   # useCityEngine, useClimateControls, useTimelinePlayback
│   ├── components/
│   │   ├── hud/                     # TopBar, TimelineScrubber, ConstructionSequence, Tooltips
│   │   ├── modals/                  # AIMayorModal, DistrictDirectoryModal, PostcardModal
│   │   └── panels/                  # LeftSidebar, InspectorDrawer
│   ├── data/                        # Static showcase developer profiles (offline fallback)
│   ├── domain/                      # Pure, framework-agnostic business logic
│   │   ├── city/                    # Blueprint builder, district analysis, climate calculation, styles
│   │   ├── decision/                # Municipal plan schema contract, prompt builder, validator
│   │   └── github/                  # Raw payload mapping, metrics, commit classifier, fingerprinting
│   ├── engine/                      # Three.js 3D rendering engine
│   │   ├── builders/                # Procedural buildings, district ground, transit corridors, monuments
│   │   ├── materials/               # Procedural window textures, glowing glass, water shaders
│   │   └── systems/                 # Traffic particle simulation, transit loops, ambient life
│   ├── services/                    # Client transport layers (proxy-first with direct fallback)
│   │   ├── gemini/                  # Gemini client, IndexedDB/localStorage cache, key store
│   │   └── github/                  # GitHub profile client with progress phase reporting
│   └── styles/                      # Tailwind and custom glassmorphism styles
├── tests/                           # Complete Vitest test suite (405 tests)
├── vercel.json                      # Vercel configuration (SPA rewrites, headers, serverless routing)
└── vite.config.ts                   # Vite bundler configuration & local API middleware
```

---

## How It Works

### 1. Ingestion & Normalization
When a username is requested, GitPolis queries `/api/github/:username` (or falls back to `api.github.com`). Raw GitHub responses are normalized into a unified `GitHubProfilePayload` containing repository metadata, language bytes, topic tags, open issues, and commit histories.

### 2. Pure Blueprint Synthesis
`planCityBlueprint(payload, options)` executes deterministically:
* **District Allocation**: Repositories are categorized into functional zones (`downtown_financial_core`, `cybernetics_ai_biosphere`, `logistics_cloud_docks`, `civic_arts_district`, `ancient_heritage_quarter`).
* **Prosperity & Fulfillment**: Calculates objective maintainer health, documentation coverage, license prestige, and release cadence.
* **Procedural Seeding**: A pseudo-random generator seeded by the user's login ensures consistent building heights, window layouts, and street distributions.

### 3. Atmospheric Climate System
The city's weather and solar time-of-day are computed dynamically from real commit metrics:
* **Push Velocity (`recentPushCount`)**: Total repository pushes over the last 14–30 days.
* **Commit Recency (`daysSinceLast`)**: Days since the most recent commit or push event.
* **Atmospheric State**: High-velocity sprints yield an *Electric Drizzle* with rain particle shaders; steady active streaks produce *Radiant Daylight*; dormant profiles transition into *Golden Mist* or twilight.

### 4. 3D WebGL Scene Construction
`CityScene` constructs the 3D scene:
* Base island terrain with shoreline water shaders.
* Custom building geometries with emissive window matrices.
* Ambient vehicular traffic, elevated transit rails, and beacon spires.
* Scrubbable 4D historical playback tracking the evolution of the developer's work over time.

### 5. Gemini AI Mayor Decision Engine
Visitors can activate the AI Mayor to generate a `MunicipalDecisionPlan`:
* Structured JSON validation strictly enforces civic titles, historical epochs, and transit synergies.
* The 3D engine instantiates glowing inter-district transit networks and landmark monuments.
* The atmosphere and HUD solar clocks synchronize seamlessly with the AI Mayor's recommended climate.
* Plans are cached deterministically in IndexedDB/localStorage by profile fingerprint to prevent redundant API token consumption.

---

## API Specification

Both serverless routes enforce same-origin isolation and reject unauthorized cross-origin requests.

### `GET /api/github/:username`
Retrieves normalized profile metadata, ranked repositories, and commit telemetry.

* **Headers**: `x-github-token` (optional; overrides server-side token)
* **Caching**: Anonymous requests cached in-memory for 15 minutes; authenticated requests are never cached to preserve privacy.
* **Rate Limit**: 30 requests per minute per IP.
* **Responses**:
  * `200 OK`: Valid `GitHubProfilePayload`
  * `400 Bad Request`: Invalid username format
  * `404 Not Found`: GitHub user not found
  * `429 Too Many Requests`: Upstream GitHub rate limit exceeded (includes reset timestamp)
  * `500 Internal Server Error`: Server failure

### `POST /api/gemini/decisions`
Submits developer telemetry to Gemini and returns a validated `MunicipalDecisionPlan`.

* **Headers**: `x-gemini-key` (optional; server `GEMINI_API_KEY` takes precedence)
* **Body**: `{ "payload": GitHubProfilePayload }` (maximum 192 KB)
* **Rate Limit**: 10 requests per minute per IP.
* **Responses**:
  * `200 OK`: `{ "plan": MunicipalDecisionPlan }`
  * `400 Bad Request`: Malformed payload or invalid API key
  * `413 Payload Too Large`: Body exceeds size limit
  * `429 Too Many Requests`: Upstream Gemini quota reached
  * `502 Bad Gateway`: Upstream AI model generation failure
  * `503 Service Unavailable`: No server API key configured and no client key supplied

---

## Deployment

### Vercel (Recommended — Free Production Deployment)

GitPolis is configured for zero-configuration deployment on Vercel:

1. Import the repository into your [Vercel Dashboard](https://vercel.com).
2. Set Environment Variables in Project Settings:
   * `GEMINI_API_KEY`: Your Google AI Studio API key (free tier available).
   * `GITHUB_TOKEN`: (Optional) GitHub personal access token to expand API rate limits.
3. Deploy.

The build process automatically runs `scripts/build-serverless.mjs` via the build command:
```bash
tsc -b && vite build && node scripts/build-serverless.mjs
```
This generates standalone, self-contained ESM JavaScript handlers in `api/` that execute cleanly on Vercel's Node 20 runtime without external resolution errors. `vercel.json` ensures client-side SPA routing (`/?user=...`) is handled seamlessly.

### Static Hosting (Netlify, Cloudflare Pages, GitHub Pages)

When hosted as a pure static bundle without serverless functions:
* Static assets in `dist/` can be served directly from any CDN or object store.
* `public/_headers` provides production-grade security headers (CSP, HSTS, X-Frame-Options) for compatible hosts.
* The application automatically falls back to querying `api.github.com` from the browser and invites visitors to input their own free Gemini key in the settings panel.

---

## Security Model

* **No Leaked Secrets**: Client bundles contain zero credentials. Only `VITE_` prefixed public variables are exposed.
* **Safe Key Storage**: Visitor-provided API keys are kept strictly in `sessionStorage` (cleared when the browser tab closes) and transmitted exclusively via HTTP headers (`x-gemini-key` or `x-goog-api-key`). Keys are never logged or stored in URLs.
* **Content Security Policy (CSP)**: Enforces strict source restrictions allowing only self-hosted scripts, GitHub avatars (`avatars.githubusercontent.com`), Google AI Studio endpoints (`generativelanguage.googleapis.com`), and GitHub API access.
* **Same-Origin Protection**: Serverless proxy endpoints validate origin headers to prevent third-party website embedding or unauthorized API proxying.
* **Private Data Isolation**: Authenticated GitHub requests are excluded from shared server caches to ensure private repository data cannot be served to subsequent visitors.

---

## Testing & Quality Assurance

The codebase enforces strict test coverage floors across all layers:

```bash
npm run test:coverage
```

Current test metrics:
* **26 Test Suites / 405 Automated Tests**: 100% passing.
* **Domain Layer**: 100% deterministic test coverage for blueprint math, procedural PRNG, commit classification, and schema validation.
* **Services Layer**: Full mock coverage for proxy negotiation, network retries, quota fallbacks, and storage degradation.
* **Serverless Layer**: Integration tests verifying rate limiting, payload bounding, error mapping, and cache isolation.

Continuous Integration (`.github/workflows/ci.yml`) runs linting, type checks, coverage verification, and full production builds on every push to `main` and all pull requests.

---

## License

GitPolis is open-source software licensed under the [MIT License](./LICENSE).
