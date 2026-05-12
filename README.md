# Strava Overlay Studio

A browser-based design tool that lets athletes generate Instagram-story-style overlays on top of their photos using their Strava activity data. Built as a Module Federation micro-frontend (shell + two remotes) to demonstrate fintech-style architecture patterns.

## Status

**Phase 3 — Konva editor with lossless PNG export.** Drop a photo, add overlays (text, stat-card, route, divider), drag/resize/rotate them, export as PNG at the photo's native resolution. The export pipeline (`apps/overlay-editor/src/lib/export.ts`) renders to a fresh offscreen Konva stage at native dimensions with `pixelRatio: 1` so overlays stay sharp instead of being upscaled from a small preview. Overlay positions are stored as relative coords (`[0..1]`) so the same set scales to the live preview and the export with no recomputation.

**Phase 2 — Cloudflare Worker for Strava OAuth.** Worker bundles, typechecks, and is wired into CI. Cloudflare deploy is a one-time manual step (`wrangler login` → `wrangler secret put` → `wrangler deploy`) documented below.

**Phase 1 — Monorepo + three Netlify sites — green.**

Federation, the activity picker, and BYOK design-history land in Phases 4–7 (see `SPEC.md`).

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

## Local dev with Nix (optional, recommended)

A `flake.nix` pins Node 20, pnpm, and `process-compose` — everyone on the team gets the same toolchain regardless of their host OS or what's in `~/.nvm`.

```bash
# One-time
nix develop              # drops you into the shell with everything on PATH
pnpm install
cp apps/shell/.env.example apps/shell/.env.local                  # fill in Strava client id, worker URL, redirect URI
cp auth-worker/.dev.vars.example auth-worker/.dev.vars            # fill in Strava client id + secret for local wrangler dev

# Spin up all four processes (shell + editor + history + worker)
# in one TUI dashboard:
process-compose          # from inside `nix develop`
# or:
nix run                  # auto-enters the shell and launches process-compose
```

`process-compose.yaml` wires the three Vite apps (ports 3000/3001/3002) and `wrangler dev` for the auth worker (port 8787). Each process is independent — the Vite apps still start green even if `.dev.vars` is empty, so you can iterate on UI without auth set up.

[direnv](https://direnv.net/) users: an `.envrc` is checked in. Run `direnv allow` once and the shell auto-loads when you `cd` into the repo. Pair with [nix-direnv](https://github.com/nix-community/nix-direnv) for cached, fast reloads.

Don't have Nix? The plain pnpm commands below still work — Nix just removes "what version of Node / pnpm do you have?" as a variable.

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
