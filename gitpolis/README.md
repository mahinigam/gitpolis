# GitPolis — Living 3D City Built from GitHub

Turn any GitHub username into a living, interactive 3D coastal city shaped by every repository's programming languages, commit history, estimated lines of code (LOC), stars, forks, activity state, and profile history.

## Requirements

- **Node.js 18+** (Node 20 LTS recommended) and `npm`

## Run Locally on Your Device

1. Unzip `gitpolis-app.zip` and open a terminal inside the extracted folder:
   ```bash
   cd gitpolis
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the app:
   ```bash
   npm run dev
   ```
4. Open your browser at:
   ```
   http://localhost:5173
   ```

## Production Preview (Optional)

```bash
npm run build
npm run preview
```
Then open `http://localhost:4173`.

## Optional: Higher GitHub Rate Limits (5,000 req/hr)

GitHub's public unauthenticated API allows 60 requests/hour per IP. Inside the app, click **API Key** in the top bar to paste a read-only GitHub Personal Access Token (kept in browser memory only) to unlock 5,000 requests/hour and deeper commit sampling across more repositories.

## Controls

- **Left-drag**: Orbit camera
- **Right-drag / WASD / Arrow keys**: Fly & pan across the city
- **Scroll**: Zoom from regional overview to street level
- **Click any repo block, building, or Central Plaza**: Fly in and inspect architectural DNA, LOC, languages, and commit blueprints
- **Bottom timeline bar**: Scrub or play the chronological city growth time-lapse
- **Top-right Postcard button**: Export a high-resolution PNG postcard of your city
