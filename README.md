# Strava Overlay Studio

A browser-based design tool that lets athletes generate Instagram-story-style overlays on top of their photos using their Strava activity data. Built as a Module Federation micro-frontend (shell + two remotes) to demonstrate fintech-style architecture patterns.

## Status

**Phase 4 — Strava OAuth + activity picker in the shell.** The shell now drives a real OAuth round-trip: `Login` redirects to Strava → callback POSTs `?code=` to the auth worker → `Atom.kvs(sessionStorage)` persists the validated session → `ActivityPicker` renders the user's recent activities. Tokens auto-refresh on 401 via the worker's `/refresh` endpoint, persisting the new session back to the same atom. State is all Atom-based (no `useState` for shared state, no `useEffect` for data fetching) — `activitiesAtom` is a derived effect atom that re-runs when `sessionAtom` changes.

**Phase 3 — Konva editor with lossless PNG export.** Drop a photo, add overlays (text, stat-card, route, divider), drag/resize/rotate them, export as PNG at the photo's native resolution. Offscreen Konva stage at native dimensions with `pixelRatio: 1`; overlay positions are relative `[0..1]` so the same set scales to preview and export with no recomputation.

**Phase 2 — Cloudflare Worker for Strava OAuth.** Worker bundles, typechecks, and is wired into CI. Cloudflare deploy is a one-time manual step (`wrangler login` → `wrangler secret put` → `wrangler deploy`) documented below.

**Phase 1 — Monorepo + three Netlify sites — green.**

Federation, real-data overlay templates, and BYOK design-history land in Phases 5–7 (see `SPEC.md`).

## Apps

| App | Port (dev) | Purpose |
|---|---|---|
| `apps/shell` | 3000 | Host shell — Strava auth, activity picker, routes |
| `apps/overlay-editor` | 3001 | Remote — Konva canvas, overlays, lossless PNG export |
| `apps/design-history` | 3002 | Conditional remote — BYOK Firebase design history |

## Tooling

- **pnpm** workspaces (`pnpm@10`)
- **Vite** per app
- **React 18 + TypeScript (strict)**
- **Tailwind CSS v4** per app (no root-level Tailwind)
- Node 20+ (see `.nvmrc`)

## Common commands

```bash
pnpm install            # install all workspace deps
pnpm dev                # run all three apps in parallel
pnpm dev:shell          # shell only on :3000
pnpm dev:editor         # overlay-editor only on :3001
pnpm dev:history        # design-history only on :3002
pnpm build              # build all apps
pnpm typecheck          # tsc --noEmit across all packages
pnpm lint               # eslint across all packages
```

## Deploy targets

| App | URL |
|---|---|
| Shell | https://strava-overlay-shell.netlify.app/ |
| Overlay Editor | https://strava-overlay-editor.netlify.app/ |
| Design History | https://strava-overlay-history.netlify.app/ |
| Auth worker | _Pending deploy_ — see "Deploying the auth worker" below |

Phase 1 deploys are manual (Netlify CLI / UI). Phase 8 wires CI-driven, path-filtered GitHub Actions to take over so each app only redeploys when its own code or shared deps change. Workflow files already live in `.github/workflows/` — they'll start firing once merged to `main` and the secrets below are set.

## Running the shell locally (Phase 4)

The shell needs three Vite env vars to drive OAuth. Copy the example and fill in your values:

```bash
cp apps/shell/.env.example apps/shell/.env.local
# edit apps/shell/.env.local
```

Required vars:

| Var | Source | Notes |
|---|---|---|
| `VITE_STRAVA_CLIENT_ID` | https://strava.com/settings/api → Client ID | Public — appears in the authorize URL |
| `VITE_OAUTH_WORKER_URL` | `wrangler deploy` output (or `http://localhost:8787` for local worker dev) | Base URL — paths `/exchange` and `/refresh` are appended |
| `VITE_REDIRECT_URI` | A URL whose host matches your Strava app's Authorization Callback Domain | `http://localhost:3000/callback` for local dev; `https://strava-overlay-shell.netlify.app/callback` for the deployed site |

Then `pnpm dev:shell` and open `http://localhost:3000`. Click **Connect with Strava** → approve → you should land back on the activity picker with your recent activities listed.

`apps/shell/src/lib/env.ts` reads these at module load and throws if any are empty, so a missing var fails loudly at boot instead of mid-OAuth.

## Deploying the auth worker

The Cloudflare Worker lives in `auth-worker/` (intentionally outside the pnpm workspace — different runtime, different bundler). One-time setup, then deploy:

```bash
cd auth-worker
npm install                          # already done if you ran it once
npx wrangler login                   # opens browser, authorizes wrangler
npx wrangler secret put STRAVA_CLIENT_ID       # paste from strava.com/settings/api
npx wrangler secret put STRAVA_CLIENT_SECRET   # paste from strava.com/settings/api
npx wrangler deploy                  # publishes; prints the public URL
```

Save the printed URL (e.g. `https://strava-oauth-worker.<your-sub>.workers.dev`) — Phase 4 will set it as `VITE_OAUTH_WORKER_URL` for the shell.

Smoke-test the deploy:

```bash
# OPTIONS preflight should return 200 with CORS headers
curl -i -X OPTIONS https://strava-oauth-worker.<your-sub>.workers.dev/exchange \
  -H "Origin: http://localhost:3000"

# GET should return 405
curl -i https://strava-oauth-worker.<your-sub>.workers.dev/exchange

# Full OAuth round-trip:
# 1. Visit (replace YOUR_CLIENT_ID):
#    https://www.strava.com/oauth/authorize?client_id=YOUR_CLIENT_ID&response_type=code&redirect_uri=http://localhost:3000/callback&approval_prompt=auto&scope=read,activity:read_all
# 2. Approve, copy the `code` from the resulting URL
# 3. Exchange it:
curl -X POST https://strava-oauth-worker.<your-sub>.workers.dev/exchange \
  -H "Content-Type: application/json" \
  -d '{"code":"YOUR_CODE"}'
# → JSON with access_token, refresh_token, expires_at, athlete (Schema-validated)
```

For CI-driven deploys (lands fully in Phase 8), the workflow at `.github/workflows/deploy-worker.yml` needs two GitHub secrets:

- `CLOUDFLARE_API_TOKEN` — Cloudflare dashboard → My Profile → API Tokens → "Edit Cloudflare Workers" template
- `CLOUDFLARE_ACCOUNT_ID` — Cloudflare dashboard → Workers & Pages → right sidebar

(The Strava client ID / secret are set via `wrangler secret put` and **persist across deploys** — never set them in the workflow, they'd be wiped on every deploy.)

## Repo layout

```
.
├── apps/
│   ├── shell/            (Netlify site)
│   ├── overlay-editor/   (Netlify site, will become federated remote)
│   └── design-history/   (Netlify site, will become federated remote)
├── packages/
│   └── shared/           (types, schemas, atoms, utils)
└── auth-worker/          (Cloudflare Worker, Strava OAuth token exchange; not a workspace member)
```

See `SPEC.md` for the full implementation plan.
