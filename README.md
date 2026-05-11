# Strava Overlay Studio

A browser-based design tool that lets athletes generate Instagram-story-style overlays on top of their photos using their Strava activity data. Built as a Module Federation micro-frontend (shell + two remotes) to demonstrate fintech-style architecture patterns.

## Status

**Phase 1 — Monorepo scaffold + hello-world deploys.** All three apps build locally and run on dedicated ports. Federation, Strava OAuth, and the Konva editor land in subsequent phases (see `SPEC.md`).

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

To be filled in once Netlify sites are provisioned (Phase 1 step 12):

- Shell: _TBD_
- Editor: _TBD_
- History: _TBD_
- Auth worker: _TBD_ (Phase 2)

## Repo layout

```
.
├── apps/
│   ├── shell/            (Netlify site)
│   ├── overlay-editor/   (Netlify site, will become federated remote)
│   └── design-history/   (Netlify site, will become federated remote)
├── packages/
│   └── shared/           (types, schemas, atoms, utils)
└── auth-worker/          (Cloudflare Worker — added in Phase 2; not a workspace member)
```

See `SPEC.md` for the full implementation plan.
