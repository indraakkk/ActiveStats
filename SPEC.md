# Strava Overlay Studio — Implementation Spec

> **Audience:** Claude Code agent executing this build.
> **Style:** Phases are sequential. Each phase has explicit acceptance criteria. Do not skip ahead. If a phase's acceptance criteria fail, fix before proceeding.

---

## 0. Project Context

A browser-based design tool that lets athletes generate Instagram-story-style overlays on top of their photos using their Strava activity data (distance, pace, elevation, route polyline). Output is a downloadable PNG at the **original photo's native resolution** (no quality loss).

The app is built as a **Module Federation micro-frontend** to demonstrate fintech-style architecture patterns (shell host loads independently deployed remotes at runtime). Inspired by FrankieOne's embedded KYC model — same architectural shape, different domain.

**Non-goals:** server-side rendering, user accounts on our infrastructure, real-time collaboration, mobile-native app, video export.

---

## 1. Locked Architectural Decisions

These are decided. **Do not propose alternatives unless a phase's acceptance criteria cannot be met.**

| Concern | Decision | Reason (for context only — do not re-litigate) |
|---|---|---|
| Package manager | **pnpm** | Module Federation maturity; Bun has known Vite-monorepo bugs |
| Monorepo tool | **pnpm workspaces** (no Turborepo/Nx) | 3 apps + 1 shared = doesn't need orchestrator |
| Bundler | **Vite** | Required by `@originjs/vite-plugin-federation` |
| Federation plugin | **`@originjs/vite-plugin-federation`** | Only viable Module Federation for Vite |
| Framework | **React 18 + TypeScript (strict)** | — |
| **Effect framework** | **Effect-TS (`effect`) + `@effect-atom/atom-react`** | First-class TS for all async, fetch, concurrency, retries, error handling. Mandatory — see §1.5. |
| **HTTP client** | **`@effect/platform` HttpClient + HttpApi** | Type-safe, schema-validated, composable with Effect. Forbidden: raw `fetch`. |
| **State management (app + cross-MFE)** | **`Atom` from `@effect-atom/atom-react`** | Reactive primitives that compose with Effect natively. Replaces Zustand entirely. |
| **Schema / validation** | **`Schema` from `effect`** | Validate all external data (Strava API responses, BYOK config, OAuth response) |
| Canvas library | **Konva + react-konva** | `pixelRatio` parameter enables lossless export; better React DX than Fabric. Imperative, NOT wrapped in Effect except at I/O boundaries. |
| Polyline decoding | **`@mapbox/polyline`** | Strava uses Google polyline format |
| Styling | **Tailwind CSS + shadcn/ui** | Fast UI iteration, no design system to maintain |
| Auth backend | **Cloudflare Worker** (in `auth-worker/`, monorepo, not a workspace member) | Strava OAuth requires `client_secret` server-side; PKCE not supported by Strava |
| User data storage | **BYOK Firebase** (user's own project) | Zero database on our side; user owns their data |
| Hosting (frontend) | **Netlify, 3 separate sites** | One per app; deploys independently |
| Hosting (worker) | **Cloudflare Workers** | Free tier, edge runtime, perfect for stateless auth |

---

## 1.5. Effect-TS Conventions (NON-NEGOTIABLE)

**This section overrides any conflicting habit, pattern, or external example.** When in doubt, re-read this section. Violations require explicit justification in a code comment referencing this section by anchor.

### 1.5.0 Sources of Truth (READ THIS FIRST)

When writing Effect code, **the ONLY acceptable sources for API usage, types, and patterns are listed below.** Do not invent APIs, do not extrapolate from prior knowledge, do not pattern-match against Medium articles or Stack Overflow. Effect has had multiple breaking renames (e.g. `@effect-rx/rx-react` → `@effect-atom/atom-react`, `@effect/schema` consolidated into `effect`), and stale tutorials *confidently demonstrate wrong APIs*. Trust nothing outside the list below.

#### Allowed sources

| For this package | Use ONLY |
|---|---|
| `effect` (core, including `Schema`, `Data`, `Effect`, `Context`, `Layer`, `Schedule`, `Stream`, `Match`, etc.) | https://effect.website/docs/* — official docs<br>https://effect.website/llms-full.txt — full docs LLM-optimized<br>https://effect.website/llms-small.txt — compressed docs for tighter contexts<br>https://github.com/Effect-TS/effect — source code, type definitions, issues |
| `@effect/platform` (HttpClient, HttpApi, FetchHttpClient, etc.) | https://effect.website/docs/platform/* — official docs<br>https://github.com/Effect-TS/effect/tree/main/packages/platform — source |
| `@effect-atom/atom-react` (React hooks: useAtom, useAtomValue, useAtomSet, useRunEffect, Atom, Result, AtomHttpApi, etc.) | https://github.com/tim-smart/effect-atom — official repo (README is the docs)<br>https://atom.kitlangton.com/ — official examples site |

**Tim Smart's effect-atom is the authoritative source for the React binding** because:
- It is the actual package Claude Code installs (`@effect-atom/atom-react` on npm)
- Tim Smart is a core Effect maintainer; this is the official React integration
- The package was renamed from `@effect-rx/rx-react` in 2025 — most tutorials reference the old name and the old API surface

#### Forbidden sources

Do not consult, cite, or take patterns from:

- ❌ Medium articles, dev.to posts, hashnode, Substack
- ❌ Stack Overflow (Effect changes too fast; SO answers are usually stale)
- ❌ Random GitHub repos that "use Effect" but aren't the official ones above
- ❌ YouTube transcripts, conference talk slides, blog posts (even by Effect maintainers — code in blog posts ages out)
- ❌ ChatGPT/Claude/Gemini conversations from prior projects (parametric memory is unreliable for Effect APIs)
- ❌ Anything mentioning `@effect-rx/rx-react`, `@effect/schema` as a separate package, `rx.runtime`, `rx.fn` — these are old names
- ❌ Anything from before Effect 3.0 (API was unstable; patterns changed)

#### Verification protocol

Before using any Effect API that you are not 100% certain about (and especially `@effect-atom/atom-react` APIs, since they're newer and less stable), Claude Code MUST:

1. **State the API in question** — e.g. "I'm about to use `Atom.kvs` for sessionStorage persistence"
2. **Fetch the relevant source page** before writing the code — either an `effect.website` docs page or the `tim-smart/effect-atom` README
3. **Quote the signature from that source** in a code comment above the usage
4. **Only then write the code**

This adds 30 seconds per unfamiliar API and prevents hours of debugging hallucinated patterns. If a fetch fails or the API isn't documented, **stop and ask** rather than guess.

#### When the docs disagree with this spec

If the official Effect docs show a pattern that conflicts with something in this spec (e.g. a function signature changed, a module moved), **the docs win**. Update this spec via a code review with the user; do not silently follow the spec's stale version.

#### Known hallucinations (LLM-specific anti-patterns)

These are wrong patterns Claude frequently generates from outdated training data. If you find yourself writing any of these, STOP and check the official docs:

| Hallucination | Correct (current) |
|---|---|
| `import { ... } from "@effect-rx/rx-react"` | `import { ... } from "@effect-atom/atom-react"` |
| `import { Schema } from "@effect/schema"` | `import { Schema } from "effect"` |
| `Rx.make(...)` / `Rx.fn(...)` / `Rx.runtime(...)` | `Atom.make(...)` / `runtimeAtom.fn(...)` / `Atom.runtime(...)` |
| `useRx(...)` / `useRxValue(...)` / `useRxSet(...)` | `useAtom(...)` / `useAtomValue(...)` / `useAtomSet(...)` |
| `Effect.tryCatchPromise({...})` | `Effect.tryPromise({ try, catch })` |
| `Effect.attempt(...)` | `Effect.try(...)` |
| `pipe(eff, Effect.flatMap(...))` outside fn body | Inside `Effect.gen`, use `yield*` instead of `.pipe` chains |
| `Context.Tag<MyService>()("MyService", { ... })` | `class MyService extends Context.Tag("MyService")<MyService, {...}>() {}` |
| `Layer.succeed(MyService, impl)` for Effects | `Layer.effect(MyService, Effect.gen(function*(){ ... return MyService.of({...}) }))` |
| `Effect.fail(new Error("..."))` for app errors | `Data.TaggedError("SomethingFailed")<{...}>` then `Effect.fail(new SomethingFailed({...}))` |
| `Schema.decode(schema)(input)` for unknown input | `Schema.decodeUnknown(schema)(input)` |
| `Effect.runPromise` inside a React hook body | `useAtomValue(runtimeAtom.atom(eff))` |

When unsure whether a pattern is current, the verification protocol above is mandatory: fetch the doc page, quote the signature, then write the code.

---

### 1.5.1 Mandatory Use

Effect-TS is the **default** for the following — there is no "I'll just use a Promise here":

| Domain | Use this | NEVER use |
|---|---|---|
| HTTP requests (all of them) | `HttpClient` + `HttpApi` from `@effect/platform` | raw `fetch()`, `axios`, `ky` |
| Async control flow | `Effect.gen(function*() {...})` | `async function`, `await` outside Effect interop boundary |
| Concurrency (parallel work) | `Effect.all([...], { concurrency: N })` | `Promise.all`, `Promise.allSettled` |
| Retry / backoff | `Effect.retry(eff, Schedule.exponential(...))` | manual retry loops, `setTimeout` retries |
| Timeout | `Effect.timeout(eff, "5 seconds")` | `Promise.race` with manual timer |
| Error handling | tagged errors + `Effect.catchTag` / `Effect.catchAll` | `try/catch` (forbidden inside `Effect.gen`) |
| External data validation | `Schema.decodeUnknown(MySchema)` | `as` casts, manual `if (typeof ...)` |
| Cancellation | Effect interruption (automatic via `useRunEffect`, `Atom.runtime`) | `AbortController` (allowed only at the Effect↔platform boundary) |
| React state (anything beyond a single component's transient UI flag) | `Atom.make(...)` + `useAtomValue` / `useAtomSet` / `useAtom` | `useState` for shared state, `useReducer`, Zustand, Redux |
| Async side effects from React | `Atom.runtime(layer).fn(eff)` consumed via `useAtomSet` | `useEffect(() => { fetch... })`, `useEffect(() => { someAsyncFn().then(...) })` |

### 1.5.2 Tagged Errors — All Failures Are Typed

Every failure must be a tagged error class. The `E` channel of `Effect<A, E, R>` is the **complete** list of expected failures. Inferring `unknown` or widening to `Error` is a violation.

```typescript
// ✅ CORRECT
import { Data } from "effect";

export class StravaTokenExpired extends Data.TaggedError("StravaTokenExpired")<{
  readonly expiredAt: number;
}> {}

export class StravaApiError extends Data.TaggedError("StravaApiError")<{
  readonly status: number;
  readonly endpoint: string;
}> {}

export class StravaRateLimited extends Data.TaggedError("StravaRateLimited")<{
  readonly retryAfterSeconds: number;
}> {}

// Consumer narrows by tag — exhaustively type-checked
const program = listActivities(token).pipe(
  Effect.catchTag("StravaTokenExpired", () => refreshAndRetry()),
  Effect.catchTag("StravaRateLimited", (e) =>
    Effect.sleep(`${e.retryAfterSeconds} seconds`).pipe(
      Effect.zipRight(listActivities(token))
    )
  ),
  Effect.catchTag("StravaApiError", (e) =>
    Effect.logError(`API failure: ${e.endpoint} → ${e.status}`).pipe(
      Effect.zipRight(Effect.succeed([]))
    )
  )
);

// ❌ WRONG — string error, no narrowing, unknown error channel
const bad = Effect.tryPromise({
  try: () => fetch("..."),
  catch: (e) => `Something failed: ${String(e)}`,
});
```

### 1.5.3 Services, Layers, Context

External dependencies (Strava client, Firebase, env vars) are **services**, provided via `Layer`. No singletons, no module-level `new Client()`.

```typescript
// ✅ CORRECT — service + layer
import { Context, Effect, Layer } from "effect";

export class StravaClient extends Context.Tag("StravaClient")<
  StravaClient,
  {
    readonly listActivities: (page: number) =>
      Effect.Effect<readonly SummaryActivity[], StravaApiError | StravaTokenExpired>;
    readonly getActivity: (id: number) =>
      Effect.Effect<DetailedActivity, StravaApiError | StravaTokenExpired>;
  }
>() {}

export const StravaClientLive = Layer.effect(
  StravaClient,
  Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const tokens = yield* TokenStore;
    return StravaClient.of({
      listActivities: (page) => /* impl */,
      getActivity: (id) => /* impl */,
    });
  })
);
```

The runtime that knows about all these services lives at the root of each app:

```typescript
// apps/shell/src/runtime.ts
import { Atom } from "@effect-atom/atom-react";
import { Layer } from "effect";
import { FetchHttpClient } from "@effect/platform";

const AppLayer = Layer.mergeAll(
  FetchHttpClient.layer,
  StravaClientLive,
  TokenStoreLive,
);

export const runtimeAtom = Atom.runtime(AppLayer);
```

### 1.5.4 React Integration Rules

React components consume Effects through Atoms. The mental model:

- **`Atom.make(initialValue)`** → like `useState` but shared and composable
- **`runtimeAtom.atom(effect)`** → an Effect that resolves to a value; component reads it with `useAtomValue` and gets a `Result<A, E>` (Initial / Loading / Success / Failure)
- **`runtimeAtom.fn(effectFn)`** → a callable Effect (mutation); component gets a setter via `useAtomSet`
- **`useRunEffect(eff)`** → fire-and-forget runner that auto-interrupts on unmount

```typescript
// ✅ CORRECT — component reads an Atom-backed query
import { useAtomValue, Result } from "@effect-atom/atom-react";

const activitiesAtom = runtimeAtom.atom(
  Effect.gen(function* () {
    const strava = yield* StravaClient;
    return yield* strava.listActivities(1);
  })
);

function ActivityPicker() {
  const result = useAtomValue(activitiesAtom);

  return Result.builder(result)
    .onInitial(() => <Spinner />)
    .onWaiting(() => <Spinner />)
    .onFailure((e) => <ErrorView error={e} />)
    .onSuccess((activities) => <Grid items={activities} />)
    .render();
}

// ❌ WRONG — useEffect + fetch + useState
function Bad() {
  const [data, setData] = useState(null);
  useEffect(() => {
    fetch("/api/activities").then((r) => r.json()).then(setData);
  }, []);
  // No type safety on errors, no cancellation, no retry, no observability.
}
```

### 1.5.5 Where Effect Stops (Pragmatic Boundaries)

Effect is for **async, I/O, error-prone, or composable** work. Do **not** wrap:

- Synchronous Konva canvas mutations (`stage.add()`, `layer.draw()`, transformer events)
- Pure data transforms (formatters, polyline → coord conversion, math)
- React's own rendering and event handlers (`onClick` is fine; what it *calls* into may be Effect)
- Single-component transient UI flags (`useState(false)` for a hover state is fine — Atoms are for shared state)

The rule: **isolate imperative/synchronous code behind an Effect boundary at the I/O edge.** For example, the lossless export pipeline is one `Effect` from end to end (because image loading is async and can fail), but inside it the actual Konva calls are plain imperative — wrapped in `Effect.sync` or `Effect.tryPromise` only where they cross the async boundary.

```typescript
// ✅ CORRECT — Effect at the I/O edge, imperative inside
export const exportLossless = (args: ExportArgs) =>
  Effect.gen(function* () {
    const img = yield* loadImage(args.imageSrc); // Effect — can fail
    const blob = yield* Effect.try({
      try: () => renderStageToBlob(img, args),  // imperative Konva, sync
      catch: (e) => new ExportRenderError({ cause: e }),
    });
    return blob;
  });

// ❌ WRONG — wrapping every Konva call in Effect.sync
const bad = Effect.gen(function* () {
  const stage = yield* Effect.sync(() => new Konva.Stage({...}));
  const layer = yield* Effect.sync(() => new Konva.Layer());
  yield* Effect.sync(() => stage.add(layer));
  // ... noise, no added safety
});
```

### 1.5.6 Forbidden Patterns (Hard Stops)

If Claude Code is about to write any of these, **stop and re-read this section**:

- ❌ `async function foo() { const r = await fetch(...) }` — anywhere in app code
- ❌ `try { ... } catch (e) { ... }` inside an `Effect.gen` block
- ❌ `Promise.all([...])` — use `Effect.all` with explicit concurrency
- ❌ `.then(...)` / `.catch(...)` chains in app code
- ❌ `useEffect(() => { /* async work */ }, [])`
- ❌ `useState` for state that more than one component reads or that survives unmount
- ❌ `const x = await Effect.runPromise(eff)` inside a React render or hook body
- ❌ `as SomeType` for external data — use `Schema.decodeUnknown`
- ❌ Catching `unknown` or `Error` — every error path must narrow to a tagged class
- ❌ `import { fetch } from ...` or `globalThis.fetch` — use `HttpClient`

### 1.5.7 Allowed Escape Hatches (Use Sparingly)

These exist for interop and must be commented with a one-line justification:

- `Effect.tryPromise({ try, catch })` — wrapping a third-party Promise API (Firebase SDK, Konva's `.toImage()` callback, `Image` onload). Always provide a tagged `catch`.
- `Effect.runPromise(eff)` — at the **outermost** boundary only (e.g. an `onClick` handler in a leaf component, when Atom-based dispatch is genuinely awkward). Prefer `useAtomSet` first.
- `Effect.sync(() => imperativeCall())` — wrapping a single synchronous side-effecting call you need to sequence with other Effects.

### 1.5.8 Federation Boundary

The `shared` array in Module Federation MUST include the Effect runtime packages so that Atoms registered in the shell and consumed in remotes refer to the same module instance. Otherwise, providing a Layer in the shell will not satisfy a service required by an Atom in a remote — two universes of Effect.

```typescript
// In every app's vite.config.ts federation() call
shared: [
  "react",
  "react-dom",
  "effect",
  "@effect-atom/atom-react",
  "@effect/platform",
],
```

---

## 2. Repository Layout

**Single monorepo, multiple deploy targets.** The OAuth worker lives alongside the apps in `auth-worker/`. Each deploy target has its own GitHub Actions workflow with path filters, so commits that touch only `apps/shell/**` do not redeploy the worker, and vice versa.

```
strava-overlay-studio/              ← single Git repo
├── pnpm-workspace.yaml
├── package.json
├── tsconfig.base.json
├── .nvmrc                          (node 20)
├── .gitignore
├── README.md
├── .github/
│   └── workflows/
│       ├── deploy-shell.yml        (path: apps/shell, packages/shared)
│       ├── deploy-editor.yml       (path: apps/overlay-editor, packages/shared)
│       ├── deploy-history.yml      (path: apps/design-history, packages/shared)
│       ├── deploy-worker.yml       (path: auth-worker, packages/shared)
│       └── ci.yml                  (lint + typecheck + build on every PR)
│
├── apps/
│   ├── shell/                      ← Netlify site: shell.example
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── netlify.toml
│   │   └── src/
│   │       ├── main.tsx
│   │       ├── App.tsx
│   │       ├── pages/
│   │       │   ├── Home.tsx
│   │       │   ├── Callback.tsx
│   │       │   └── Editor.tsx
│   │       ├── lib/
│   │       │   ├── strava-auth.ts
│   │       │   ├── strava-api.ts
│   │       │   └── env.ts
│   │       └── components/
│   │           ├── ActivityPicker.tsx
│   │           └── ConnectStrava.tsx
│   │
│   ├── overlay-editor/             ← Netlify site: editor.example
│   │   ├── package.json
│   │   ├── vite.config.ts
│   │   ├── tsconfig.json
│   │   ├── index.html
│   │   ├── netlify.toml
│   │   └── src/
│   │       ├── main.tsx            (standalone dev entry)
│   │       ├── App.tsx             (standalone dev wrapper)
│   │       ├── Editor.tsx          (EXPOSED component)
│   │       ├── components/
│   │       │   ├── Canvas.tsx
│   │       │   ├── Toolbar.tsx
│   │       │   ├── LayerPanel.tsx
│   │       │   ├── overlays/
│   │       │   │   ├── TextOverlay.tsx
│   │       │   │   ├── StatCardOverlay.tsx
│   │       │   │   ├── RouteOverlay.tsx
│   │       │   │   └── DividerOverlay.tsx
│   │       │   └── templates/
│   │       │       ├── StravaClassic.tsx
│   │       │       └── SoreStyle.tsx
│   │       ├── lib/
│   │       │   ├── export.ts       (lossless two-pass render)
│   │       │   ├── polyline.ts
│   │       │   └── coords.ts       (relative ↔ absolute coords)
│   │       └── store/
│   │           └── editor-store.ts
│   │
│   └── design-history/             ← Netlify site: history.example
│       ├── package.json
│       ├── vite.config.ts
│       ├── tsconfig.json
│       ├── index.html
│       ├── netlify.toml
│       └── src/
│           ├── main.tsx
│           ├── App.tsx
│           ├── DesignHistory.tsx   (EXPOSED component)
│           ├── components/
│           │   ├── DesignGrid.tsx
│           │   └── ByokSetup.tsx
│           └── lib/
│               └── firebase-byok.ts
│
├── auth-worker/                    ← Cloudflare Worker (NOT a workspace package)
│   ├── package.json                (standalone, NOT in pnpm-workspace.yaml)
│   ├── wrangler.toml
│   ├── tsconfig.json
│   └── src/
│       └── index.ts
│
└── packages/
    └── shared/
        ├── package.json
        ├── tsconfig.json
        └── src/
            ├── index.ts
            ├── types/
            │   ├── strava.ts       (Activity, Athlete, OAuthTokenResponse — used by BOTH frontend and worker)
            │   ├── overlay.ts      (OverlayElement, EditorState)
            │   └── byok.ts         (FirebaseConfig)
            ├── store/
            │   └── session.ts      (atoms: user, tokens, activity, runtime layer)
            └── utils/
                ├── format.ts       (distance, pace, time)
                └── coords.ts       (lat/lng → canvas)
```

### Why `auth-worker` is NOT a pnpm workspace member

It uses a different runtime (Cloudflare Workers, not Node) and a different bundler (`wrangler`, not Vite). Including it as a workspace package would invite accidental Node-only imports into the worker. Keeping it outside the workspace but inside the repo gives us:

- ✅ Type sharing — worker imports `OAuthTokenResponse` from `packages/shared` via relative path
- ✅ Atomic PRs — one commit can change both the worker contract and the consumer
- ✅ Independent deploys — its own GitHub Actions workflow
- ✅ No bundler confusion — wrangler handles its own dependency resolution

In `auth-worker/tsconfig.json`, configure a path alias so the worker can still import from shared:

```json
{
  "extends": "../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022", "WebWorker"],
    "types": ["@cloudflare/workers-types"],
    "paths": {
      "@strava-overlay/shared": ["../packages/shared/src/index.ts"]
    }
  },
  "include": ["src/**/*", "../packages/shared/src/**/*"]
}
```

The worker imports types only — no runtime code from `packages/shared` makes it into the worker bundle (wrangler tree-shakes, and types are erased at build time anyway).

---

## 3. Phase Plan

Each phase ends with **executable acceptance criteria**. Run them. If they fail, fix before continuing.

### Phase 1 — Monorepo Scaffold + Hello World Deploys

**Goal:** All three apps deploy to Netlify as separate sites. No federation yet, no Strava yet. Prove the deploy pipeline before adding complexity.

**Prerequisite — Effect docs cache (do this FIRST, before any code):**

Before writing any Effect-using code, fetch and skim these two pages. Both are short enough to keep in context, and they're the source of truth per §1.5.0:

1. `https://effect.website/llms-small.txt` — compressed overview of core Effect APIs
2. `https://github.com/tim-smart/effect-atom/blob/main/README.md` — full reference for `@effect-atom/atom-react`

If `llms-small.txt` is too large, fall back to fetching specific pages from `effect.website/docs/` on demand — e.g. when you need `Schema`, fetch `https://effect.website/docs/schema/getting-started/`. **Never skip the fetch and "remember how it goes."**

**Tasks:**

1. Initialize repo:
   ```bash
   mkdir strava-overlay-studio && cd strava-overlay-studio
   git init
   echo "20" > .nvmrc
   pnpm init
   ```

2. Create `pnpm-workspace.yaml`:
   ```yaml
   packages:
     - "apps/*"
     - "packages/*"
   # NOTE: auth-worker is intentionally NOT a workspace member.
   # It runs on Cloudflare Workers (different runtime), bundles with wrangler
   # (not Vite), and would invite accidental Node-only imports if hoisted.
   # It lives in the repo for type-sharing via tsconfig path, deploys independently.
   ```

3. Root `package.json` — set `"private": true`. Add scripts:
   ```json
   {
     "scripts": {
       "dev:shell": "pnpm --filter shell dev",
       "dev:editor": "pnpm --filter overlay-editor dev",
       "dev:history": "pnpm --filter design-history dev",
       "dev": "pnpm -r --parallel run dev",
       "build": "pnpm -r run build",
       "lint": "pnpm -r run lint",
       "typecheck": "pnpm -r run typecheck"
     }
   }
   ```

4. Root `tsconfig.base.json`:
   ```json
   {
     "compilerOptions": {
       "target": "ES2022",
       "lib": ["ES2022", "DOM", "DOM.Iterable"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "jsx": "react-jsx",
       "strict": true,
       "noUnusedLocals": true,
       "noUnusedParameters": true,
       "noFallthroughCasesInSwitch": true,
       "skipLibCheck": true,
       "esModuleInterop": true,
       "resolveJsonModule": true,
       "isolatedModules": true,
       "allowImportingTsExtensions": false,
       "noEmit": true
     }
   }
   ```

5. Scaffold `packages/shared` first (other apps depend on it):
   ```bash
   mkdir -p packages/shared/src
   cd packages/shared
   pnpm init
   # set name to "@strava-overlay/shared", "type": "module", "main": "./src/index.ts"
   pnpm add -D typescript @types/node
   ```
   Add an empty `src/index.ts` (will fill in Phase 4). Add `tsconfig.json` extending root.

6. Scaffold each app with Vite:
   ```bash
   cd apps
   pnpm create vite shell --template react-ts
   pnpm create vite overlay-editor --template react-ts
   pnpm create vite design-history --template react-ts
   ```
   In each app's `package.json`:
   - Add `"@strava-overlay/shared": "workspace:*"` to dependencies
   - Set unique `dev` port: shell=3000, overlay-editor=3001, design-history=3002
     ```json
     "dev": "vite --port 3000 --strictPort"
     ```
   - Add scripts: `"typecheck": "tsc --noEmit"`, `"lint": "eslint src --max-warnings 0"`

7. Tailwind in each app (per app, not hoisted — each MFE owns its style pipeline):
   ```bash
   cd apps/shell
   pnpm add -D tailwindcss@latest @tailwindcss/vite
   ```
   Configure per Tailwind v4 setup (use `@import "tailwindcss"` in CSS, add `@tailwindcss/vite` plugin to `vite.config.ts`). Repeat for other two apps.

8. Each app's `src/App.tsx` shows distinct content:
   - shell: "🏔️ Strava Overlay Studio — Shell"
   - overlay-editor: "🎨 Overlay Editor (remote)"
   - design-history: "📚 Design History (remote)"

9. Create `netlify.toml` per app:
   ```toml
   # apps/shell/netlify.toml
   [build]
     base = "apps/shell"
     command = "pnpm install --frozen-lockfile && pnpm run build"
     publish = "apps/shell/dist"

   [build.environment]
     NODE_VERSION = "20"
     NPM_FLAGS = "--version"  # prevents Netlify from running npm install
     PNPM_VERSION = "9"
   ```
   Repeat with adjusted paths for the other two apps.

10. Root `.gitignore`:
    ```
    node_modules
    dist
    .env
    .env.local
    .DS_Store
    *.log
    .wrangler
    ```

11. Initial commit, push to GitHub (one repo for all three apps).

12. Create **three Netlify sites** from the same repo, each with a different `base` directory pointing to the respective app. Set the build command per `netlify.toml`.

**Acceptance criteria:**
- [ ] `pnpm install` from root succeeds with no errors
- [ ] `pnpm dev` runs all three apps in parallel on ports 3000/3001/3002
- [ ] All three apps load locally and show their distinct content
- [ ] `pnpm build` succeeds for all apps
- [ ] `pnpm typecheck` passes
- [ ] All three Netlify sites deploy green and show their respective content at public URLs
- [ ] Save the three Netlify URLs in the root `README.md`

**Anti-patterns to avoid:**
- ❌ Do NOT use `npm` or `yarn` anywhere — pnpm only
- ❌ Do NOT add Turborepo "to be safe" — out of scope
- ❌ Do NOT install Tailwind at the root — each app installs its own
- ❌ Do NOT use Vite's default ports (5173 etc) — use the federation-friendly 3000/3001/3002

---

### Phase 2 — Cloudflare Worker (OAuth Token Exchange)

**Goal:** Stateless Worker that exchanges Strava `code` for tokens. Lives in `auth-worker/` inside the monorepo but **outside the pnpm workspace**. Only piece of backend infrastructure in this project.

**Prerequisite:** User has Strava developer app at https://www.strava.com/settings/api with:
- `Client ID` and `Client Secret` available
- "Authorization Callback Domain" set to the shell's domain (use `localhost` during dev; we'll add the Netlify domain at end of Phase 4)

**Tasks:**

1. From the monorepo root, scaffold the worker. Do NOT run this with `pnpm create cloudflare` from inside a workspace directory — it gets confused. Instead:
   ```bash
   cd <monorepo-root>
   mkdir auth-worker && cd auth-worker
   npm create cloudflare@latest . -- --type=hello-world --ts=true --git=false --deploy=false
   # When prompted, decline to use git (already in monorepo's git).
   ```
   This will create `package.json`, `wrangler.toml`, `tsconfig.json`, and `src/index.ts`. The `package.json` here is standalone (not a workspace member) — its own `node_modules` lives inside `auth-worker/` after `npm install` or `pnpm install --ignore-workspace` run from this directory.

2. Set up the worker's `tsconfig.json` to share types with the frontend:
   ```json
   {
     "extends": "../tsconfig.base.json",
     "compilerOptions": {
       "lib": ["ES2022", "WebWorker"],
       "types": ["@cloudflare/workers-types"],
       "module": "ESNext",
       "moduleResolution": "bundler",
       "paths": {
         "@strava-overlay/shared": ["../packages/shared/src/index.ts"]
       },
       "noEmit": true
     },
     "include": ["src/**/*", "../packages/shared/src/**/*"]
   }
   ```

3. Replace `src/index.ts` with the implementation below. **Note:** routes are `/exchange` (initial code → token) and `/refresh` (refresh_token → new access_token).

   ```typescript
   export interface Env {
     STRAVA_CLIENT_ID: string;
     STRAVA_CLIENT_SECRET: string;
     ALLOWED_ORIGINS: string; // comma-separated, e.g. "http://localhost:3000,https://shell.netlify.app"
   }

   import { Data, Effect, Schema } from "effect";
   import { HttpClient, HttpClientRequest, HttpClientResponse, FetchHttpClient } from "@effect/platform";

   // Tagged errors per §1.5.2
   class BadRequest extends Data.TaggedError("BadRequest")<{ message: string }> {}
   class StravaUpstreamError extends Data.TaggedError("StravaUpstreamError")<{
     status: number;
     body: string;
   }> {}

   // Request body Schemas — runtime-validated, no `as` casts (§1.5.6)
   const ExchangeBody = Schema.Struct({ code: Schema.String });
   const RefreshBody = Schema.Struct({ refresh_token: Schema.String });

   function corsHeaders(origin: string | null, allowed: readonly string[]): Record<string, string> {
     const allowOrigin = origin && allowed.includes(origin) ? origin : allowed[0];
     return {
       "Access-Control-Allow-Origin": allowOrigin,
       "Access-Control-Allow-Methods": "POST, OPTIONS",
       "Access-Control-Allow-Headers": "Content-Type",
       "Access-Control-Max-Age": "86400",
       Vary: "Origin",
     };
   }

   const jsonResponse = (data: unknown, status: number, cors: Record<string, string>) =>
     new Response(JSON.stringify(data), {
       status,
       headers: { ...cors, "Content-Type": "application/json" },
     });

   // Core handler in Effect — composable, typed errors, easy to test
   const handle = (request: Request, env: Env) =>
     Effect.gen(function* () {
       const origin = request.headers.get("Origin");
       const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
       const cors = corsHeaders(origin, allowed);

       if (request.method === "OPTIONS") return new Response(null, { headers: cors });
       if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: cors });

       const url = new URL(request.url);
       const raw = yield* Effect.tryPromise({
         try: () => request.json(),
         catch: () => new BadRequest({ message: "Invalid JSON" }),
       });

       const params = new URLSearchParams({
         client_id: env.STRAVA_CLIENT_ID,
         client_secret: env.STRAVA_CLIENT_SECRET,
       });

       if (url.pathname === "/exchange") {
         const body = yield* Schema.decodeUnknown(ExchangeBody)(raw).pipe(
           Effect.mapError(() => new BadRequest({ message: "Missing code" }))
         );
         params.set("code", body.code);
         params.set("grant_type", "authorization_code");
       } else if (url.pathname === "/refresh") {
         const body = yield* Schema.decodeUnknown(RefreshBody)(raw).pipe(
           Effect.mapError(() => new BadRequest({ message: "Missing refresh_token" }))
         );
         params.set("refresh_token", body.refresh_token);
         params.set("grant_type", "refresh_token");
       } else {
         return yield* Effect.fail(new BadRequest({ message: "Unknown route" }));
       }

       const http = yield* HttpClient.HttpClient;
       const stravaRes = yield* HttpClientRequest.post("https://www.strava.com/oauth/token").pipe(
         HttpClientRequest.bodyUrlParams(params),
         http.execute
       );
       const body = yield* stravaRes.text;
       if (stravaRes.status >= 400) {
         return yield* Effect.fail(new StravaUpstreamError({ status: stravaRes.status, body }));
       }
       return jsonResponse(JSON.parse(body), 200, cors);
     }).pipe(
       Effect.catchTag("BadRequest", (e) =>
         Effect.sync(() => jsonResponse({ error: e.message }, 400, corsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS.split(","))))
       ),
       Effect.catchTag("StravaUpstreamError", (e) =>
         Effect.sync(() => jsonResponse({ error: "Upstream failed", status: e.status }, 502, corsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS.split(","))))
       ),
       Effect.catchAllDefect((d) =>
         Effect.sync(() => jsonResponse({ error: "Unexpected" }, 500, corsHeaders(request.headers.get("Origin"), env.ALLOWED_ORIGINS.split(","))))
       ),
       Effect.provide(FetchHttpClient.layer)
     );

   export default {
     fetch(request: Request, env: Env): Promise<Response> {
       return Effect.runPromise(handle(request, env));
     },
   };
   ```

   Worker dependencies (note `effect` and `@effect/platform` need to be installed in `auth-worker/`, NOT in the workspace):
   ```bash
   cd auth-worker
   npm install effect @effect/platform
   ```

   Then validate the path alias by importing the shared `OAuthTokenResponse` Schema (defined in Phase 4 step 3) into the worker — use it to validate Strava's response before forwarding to the frontend, so the worker also catches schema drift. This proves the path alias works and adds defense-in-depth.

4. `wrangler.toml`:
   ```toml
   name = "strava-oauth-worker"
   main = "src/index.ts"
   compatibility_date = "2025-05-01"

   [vars]
   ALLOWED_ORIGINS = "http://localhost:3000"
   ```

5. Set secrets (interactively — these do NOT go in the toml):
   ```bash
   wrangler secret put STRAVA_CLIENT_ID
   wrangler secret put STRAVA_CLIENT_SECRET
   ```

6. Local test:
   ```bash
   wrangler dev
   ```
   Then perform a manual OAuth round-trip:
   - Visit `https://www.strava.com/oauth/authorize?client_id=YOUR_ID&response_type=code&redirect_uri=http://localhost:3000/callback&approval_prompt=auto&scope=read,activity:read_all`
   - Approve, copy the `code` from the resulting URL
   - `curl -X POST http://localhost:8787/exchange -H "Content-Type: application/json" -d '{"code":"YOUR_CODE"}'`
   - Confirm response contains `access_token`, `refresh_token`, `athlete`

7. Deploy:
   ```bash
   wrangler deploy
   ```
   Save the deployed URL (e.g. `https://strava-oauth-worker.YOUR-SUB.workers.dev`).

**Acceptance criteria:**
- [ ] Worker deploys without error
- [ ] `curl` test against deployed Worker returns valid Strava tokens for a fresh authorization code
- [ ] CORS preflight (OPTIONS request) returns 200 with correct headers
- [ ] Wrong-method requests (GET) return 405
- [ ] Worker imports a type from `@strava-overlay/shared` successfully

**Anti-patterns:**
- ❌ Do NOT add `auth-worker` to `pnpm-workspace.yaml`. It is intentionally not a workspace member.
- ❌ Do NOT make the Worker proxy ALL Strava calls — only `/exchange` and `/refresh`. All other Strava API calls go browser → Strava directly.
- ❌ Do NOT log token values to console (Cloudflare retains logs)
- ❌ Do NOT import runtime code from `packages/shared` into the worker. **Types only.** Anything else risks pulling Node-targeted code into the Cloudflare Workers runtime.

---

### Phase 3 — Konva Editor Standalone (Lossless Export) ⭐ HARDEST PHASE

**Goal:** `overlay-editor` runs as a standalone Vite app (still no federation, still no Strava). User can: upload a photo, add draggable/resizable overlays, export as PNG **at the photo's original resolution**.

This is the engineering heart of the project. Don't proceed to Phase 4 until export quality is verified.

**Tasks:**

1. In `apps/overlay-editor`:
   ```bash
   cd apps/overlay-editor
   pnpm add konva react-konva
   pnpm add @mapbox/polyline
   pnpm add effect @effect/platform @effect-atom/atom-react
   pnpm add -D @types/mapbox__polyline
   ```

2. Create the editor store at `src/store/editor-store.ts` using Atoms (per §1.5.4). Each piece of state is its own Atom; cross-Atom derivations use `Atom.make((get) => ...)`:
   ```typescript
   import { Atom } from "@effect-atom/atom-react";
   import type { OverlayElement } from "@strava-overlay/shared";

   // Atomic state
   export const imageAtom = Atom.make<
     { src: string; naturalWidth: number; naturalHeight: number } | null
   >(null);

   // Overlay positions are stored in RELATIVE coords (0..1) for resolution independence
   export const overlaysAtom = Atom.make<readonly OverlayElement[]>([]);

   export const selectedIdAtom = Atom.make<string | null>(null);

   // Canvas display size — changes with viewport, kept separate from overlays for memo
   export const canvasDisplayAtom = Atom.make<{ width: number; height: number }>(
     { width: 0, height: 0 }
   );

   // Derived: the currently selected overlay (or null) — recomputes only when deps change
   export const selectedOverlayAtom = Atom.make((get) => {
     const id = get(selectedIdAtom);
     if (!id) return null;
     return get(overlaysAtom).find((o) => o.id === id) ?? null;
   });

   // Mutations are plain functions returning Atom setters; consumed via useAtomSet
   // (For more complex mutations involving Effects, use runtimeAtom.fn — see §1.5.4)
   ```
   Components consume these with `useAtomValue(overlaysAtom)`, `useAtomSet(selectedIdAtom)`, or `useAtom(imageAtom)`. **No `useState` for any of this state** — it must cross component boundaries (Canvas, Toolbar, LayerPanel all read/write).

3. Define `OverlayElement` union in `packages/shared/src/types/overlay.ts`:
   ```typescript
   export type RelCoord = number; // 0..1, relative to image dimensions

   export type BaseOverlay = {
     id: string;
     x: RelCoord;   // top-left, relative
     y: RelCoord;
     width: RelCoord;
     height: RelCoord;
     rotation: number; // degrees
     opacity: number;  // 0..1
   };

   export type TextOverlay = BaseOverlay & {
     kind: 'text';
     text: string;
     fontFamily: string;
     fontSize: RelCoord; // relative to image height
     fontWeight: number;
     color: string;
     align: 'left' | 'center' | 'right';
     letterSpacing: number;
   };

   export type StatCardOverlay = BaseOverlay & {
     kind: 'stat-card';
     stats: Array<{ label: string; value: string }>;
     style: 'minimal' | 'boxed';
     color: string;
     fontFamily: string;
   };

   export type RouteOverlay = BaseOverlay & {
     kind: 'route';
     polyline: string; // encoded Google polyline
     strokeColor: string;
     strokeWidth: RelCoord;
     showStartEnd: boolean;
   };

   export type DividerOverlay = BaseOverlay & {
     kind: 'divider';
     orientation: 'horizontal' | 'vertical';
     color: string;
     thickness: RelCoord;
   };

   export type OverlayElement =
     | TextOverlay | StatCardOverlay | RouteOverlay | DividerOverlay;
   ```

4. Implement the canvas at `src/components/Canvas.tsx`:
   - Use `<Stage>` and `<Layer>` from react-konva
   - Stage size = display size (calculated to fit viewport while preserving image aspect ratio)
   - `<KonvaImage>` for the photo, scaled to stage size
   - One render component per overlay kind
   - All overlays must convert their relative coords to absolute pixels using `canvasDisplay.width/height`
   - Selected overlay shows a `<Transformer>` for resize/rotate
   - Drag updates write back to store as relative coords (divide by canvas size)

5. **THE CRITICAL PIECE — `src/lib/export.ts`** (two-pass lossless render):

   ```typescript
   import Konva from 'konva';
   import { Data, Effect } from 'effect';
   import type { OverlayElement } from '@strava-overlay/shared';

   // Tagged errors — every failure path is typed (§1.5.2)
   export class ImageLoadError extends Data.TaggedError("ImageLoadError")<{
     readonly src: string;
     readonly cause: unknown;
   }> {}

   export class ExportRenderError extends Data.TaggedError("ExportRenderError")<{
     readonly cause: unknown;
   }> {}

   export type ExportArgs = {
     readonly imageSrc: string;
     readonly imageWidth: number;
     readonly imageHeight: number;
     readonly overlays: readonly OverlayElement[];
   };

   /**
    * Render overlays at the IMAGE's native resolution to an offscreen Konva stage,
    * then export as PNG. This bypasses display canvas dimensions entirely.
    *
    * Effect boundary at I/O edges (image load, sync Konva operations wrapped in
    * Effect.try). Inside, Konva is imperative — see §1.5.5.
    */
   export const exportLossless = (
     args: ExportArgs
   ): Effect.Effect<Blob, ImageLoadError | ExportRenderError> =>
     Effect.gen(function* () {
       const img = yield* loadImage(args.imageSrc);
       return yield* Effect.try({
         try: () => renderToBlob(img, args),
         catch: (cause) => new ExportRenderError({ cause }),
       });
     });

   // Image loading — wraps the platform Image API in Effect via Effect.async,
   // so cancellation propagates (e.g. component unmount aborts the load).
   const loadImage = (src: string): Effect.Effect<HTMLImageElement, ImageLoadError> =>
     Effect.async<HTMLImageElement, ImageLoadError>((resume) => {
       const img = new Image();
       img.crossOrigin = 'anonymous';
       img.onload = () => resume(Effect.succeed(img));
       img.onerror = (e) => resume(Effect.fail(new ImageLoadError({ src, cause: e })));
       img.src = src;
       // Cleanup on interruption
       return Effect.sync(() => {
         img.onload = null;
         img.onerror = null;
         img.src = '';
       });
     });

   // Purely imperative Konva work — synchronous, isolated, no Effect wrapping inside.
   // The caller wraps the call site in Effect.try; we don't double-wrap. (§1.5.5)
   function renderToBlob(img: HTMLImageElement, args: ExportArgs): Blob {
     const { imageWidth, imageHeight, overlays } = args;

     const container = document.createElement('div');
     container.style.cssText = `position:absolute;left:-99999px;top:-99999px;width:${imageWidth}px;height:${imageHeight}px;`;
     document.body.appendChild(container);

     try {
       const stage = new Konva.Stage({ container, width: imageWidth, height: imageHeight });
       const layer = new Konva.Layer();
       stage.add(layer);

       layer.add(new Konva.Image({ image: img, x: 0, y: 0, width: imageWidth, height: imageHeight }));

       for (const overlay of overlays) {
         const node = renderOverlayToKonva(overlay, imageWidth, imageHeight);
         if (node) layer.add(node);
       }
       layer.draw();

       // pixelRatio 1 — stage is ALREADY at native size, so no upscaling.
       const dataUrl = stage.toDataURL({ mimeType: 'image/png', pixelRatio: 1 });
       stage.destroy();
       return dataUrlToBlob(dataUrl);
     } finally {
       document.body.removeChild(container);
     }
   }

   function dataUrlToBlob(dataUrl: string): Blob {
     const [header, base64] = dataUrl.split(',');
     const mime = header.match(/:(.*?);/)![1];
     const binary = atob(base64);
     const buf = new Uint8Array(binary.length);
     for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
     return new Blob([buf], { type: mime });
   }

   // renderOverlayToKonva: switch on overlay.kind, build Konva.Text / Konva.Line /
   // Konva.Group etc with x/y/width/height scaled from relative (0..1) to absolute pixels.
   // For RouteOverlay, decode polyline to lat/lng, then project to the overlay's bbox.
   // Pure synchronous function — does NOT return Effect.
   ```

   Implement `renderOverlayToKonva` for each `kind`. For `RouteOverlay`, use `@mapbox/polyline` to decode and fit into the overlay's bounding box via min/max lat/lng normalization.

6. Download UX in `src/components/Toolbar.tsx` — wired through an Atom mutation so cancellation works on unmount:
   ```typescript
   import { runtimeAtom } from "../runtime";
   import { useAtomSet } from "@effect-atom/atom-react";
   import { Effect } from "effect";

   // Atom-backed export action — cancellable, retryable, observable
   const exportAtom = runtimeAtom.fn(
     Effect.fn(function* (args: ExportArgs) {
       const blob = yield* exportLossless(args);
       // Imperative DOM work for the actual download — at the leaf, synchronous
       const url = URL.createObjectURL(blob);
       const a = document.createElement("a");
       a.href = url;
       a.download = `overlay-${Date.now()}.png`;
       a.click();
       URL.revokeObjectURL(url);
     })
   );

   function ExportButton() {
     const exportPng = useAtomSet(exportAtom);
     const image = useAtomValue(imageAtom);
     const overlays = useAtomValue(overlaysAtom);
     if (!image) return null;
     return (
       <button onClick={() => exportPng({
         imageSrc: image.src,
         imageWidth: image.naturalWidth,
         imageHeight: image.naturalHeight,
         overlays,
       })}>
         Export PNG
       </button>
     );
   }
   ```

7. Stub UI:
   - Drag-and-drop image upload (read as data URL, get `naturalWidth/Height`)
   - Toolbar buttons: Add Text, Add Stat Card, Add Route, Add Divider, Export PNG
   - Right-side layer panel showing list of overlays, click to select
   - Bottom-right "Export" button

8. **Testing the lossless claim** (do this manually, write into README):
   - Upload a photo where you know the original dimensions (e.g. 4032×3024 from a phone)
   - Add a text overlay
   - Export
   - Open the resulting PNG, verify dimensions are exactly 4032×3024
   - Verify text overlay is sharp (not pixelated — it was rendered at native resolution, not upscaled from a small preview canvas)

**Acceptance criteria:**
- [ ] User can drag-and-drop an image onto the editor
- [ ] Adding a text overlay works; text is draggable, resizable, rotatable
- [ ] Adding a stat-card overlay shows mock stats (hard-coded for now, real data in Phase 5)
- [ ] Adding a route overlay renders a polyline from a hard-coded test string (will wire to real Strava in Phase 5)
- [ ] Export produces a PNG whose dimensions exactly match the source image's `naturalWidth × naturalHeight`
- [ ] Exported overlays are visually sharp at 100% zoom (no pixelation from upscaling)
- [ ] App still works as a standalone Vite app at port 3001 (do NOT break this when federation is added in Phase 6)

**Anti-patterns:**
- ❌ Do NOT store overlay positions in pixel coordinates — relative (0..1) only. Pixel coords break the moment the canvas resizes.
- ❌ Do NOT export by capturing the visible canvas. The visible canvas is at display resolution. Always render a fresh offscreen stage at native image dimensions.
- ❌ Do NOT use `pixelRatio` > 1 on the export stage. The stage is already at native size; multiplying just bloats file size without adding detail.
- ❌ Do NOT use `html2canvas` or DOM-to-image libraries. They rasterize the live DOM and degrade quality. Konva's offscreen render is the right approach.
- ❌ Do NOT use `localStorage` for the image — it can blow past quota. Keep image as in-memory data URL or object URL.

---

### Phase 4 — Strava OAuth + Activity Picker (in Shell, still no federation)

**Goal:** Shell can sign in with Strava, list the user's recent activities, and select one. Built fully in Effect-TS per §1.5 — Schema validation of all Strava responses, tagged errors, Atom-backed state, automatic token refresh via service composition.

**Tasks:**

1. In `apps/shell` add deps:
   ```bash
   cd apps/shell
   pnpm add react-router-dom
   pnpm add effect @effect/platform @effect-atom/atom-react
   ```

2. Environment config at `apps/shell/.env.local` (gitignored):
   ```
   VITE_STRAVA_CLIENT_ID=your_client_id
   VITE_OAUTH_WORKER_URL=https://strava-oauth-worker.YOUR-SUB.workers.dev
   VITE_REDIRECT_URI=http://localhost:3000/callback
   ```
   Add `apps/shell/.env.example` (committed) with placeholder values.

3. `packages/shared/src/types/strava.ts` — **define as `Schema`, not bare interfaces**. This is the single source of truth and is used for runtime validation of API responses (§1.5.6 — no `as` casts):
   ```typescript
   import { Schema } from "effect";

   export const Athlete = Schema.Struct({
     id: Schema.Number,
     firstname: Schema.String,
     lastname: Schema.String,
     profile: Schema.String,
     measurement_preference: Schema.Literal("feet", "meters"),
   });
   export type Athlete = typeof Athlete.Type;

   export const SummaryActivity = Schema.Struct({
     id: Schema.Number,
     name: Schema.String,
     distance: Schema.Number,
     moving_time: Schema.Number,
     elapsed_time: Schema.Number,
     total_elevation_gain: Schema.Number,
     type: Schema.String,
     sport_type: Schema.String,
     start_date: Schema.String,
     average_speed: Schema.Number,
     average_watts: Schema.optional(Schema.Number),
     kilojoules: Schema.optional(Schema.Number),
     map: Schema.Struct({
       id: Schema.String,
       summary_polyline: Schema.NullOr(Schema.String),
     }),
   });
   export type SummaryActivity = typeof SummaryActivity.Type;

   export const DetailedActivity = Schema.extend(
     SummaryActivity,
     Schema.Struct({
       map: Schema.Struct({
         id: Schema.String,
         polyline: Schema.NullOr(Schema.String),  // full polyline, only on detail
         summary_polyline: Schema.NullOr(Schema.String),
       }),
       calories: Schema.optional(Schema.Number),
     })
   );
   export type DetailedActivity = typeof DetailedActivity.Type;

   export const OAuthTokenResponse = Schema.Struct({
     access_token: Schema.String,
     refresh_token: Schema.String,
     expires_at: Schema.Number,  // unix seconds
     athlete: Athlete,
   });
   export type OAuthTokenResponse = typeof OAuthTokenResponse.Type;
   ```

4. **Tagged errors** at `packages/shared/src/errors/strava.ts`:
   ```typescript
   import { Data } from "effect";

   export class StravaTokenExpired extends Data.TaggedError("StravaTokenExpired")<{
     readonly expiredAt: number;
   }> {}

   export class StravaRateLimited extends Data.TaggedError("StravaRateLimited")<{
     readonly retryAfterSeconds: number;
   }> {}

   export class StravaApiError extends Data.TaggedError("StravaApiError")<{
     readonly status: number;
     readonly endpoint: string;
     readonly body: string;
   }> {}

   export class StravaSchemaError extends Data.TaggedError("StravaSchemaError")<{
     readonly endpoint: string;
     readonly cause: unknown;
   }> {}

   export class OAuthExchangeFailed extends Data.TaggedError("OAuthExchangeFailed")<{
     readonly cause: unknown;
   }> {}

   export class NoSession extends Data.TaggedError("NoSession")<{}> {}
   ```

5. **Session Atoms** at `packages/shared/src/store/session.ts` — replaces the old Zustand store. Atom-based, sessionStorage-persisted:
   ```typescript
   import { Atom } from "@effect-atom/atom-react";
   import type { Athlete, DetailedActivity, OAuthTokenResponse } from "../types/strava";

   // Tokens persist across reloads in the same tab. Use sessionStorage, NOT localStorage —
   // auth tokens should not survive a fully closed browser.
   export const tokensAtom = Atom.kvs({
     storage: typeof window !== "undefined" ? window.sessionStorage : undefined,
     key: "sos-tokens",
     schema: Schema.Struct({
       accessToken: Schema.String,
       refreshToken: Schema.String,
       expiresAt: Schema.Number,
     }),
     defaultValue: () => null,
   });

   export const athleteAtom = Atom.make<Athlete | null>(null);
   export const selectedActivityAtom = Atom.make<DetailedActivity | null>(null);
   ```

6. **`TokenStore` service** at `apps/shell/src/services/token-store.ts` — wraps the Atom for use inside Effects:
   ```typescript
   import { Context, Effect, Layer } from "effect";
   import { NoSession } from "@strava-overlay/shared";

   export class TokenStore extends Context.Tag("TokenStore")<
     TokenStore,
     {
       readonly get: Effect.Effect<{ accessToken: string; refreshToken: string; expiresAt: number }, NoSession>;
       readonly set: (tokens: { accessToken: string; refreshToken: string; expiresAt: number }) => Effect.Effect<void>;
       readonly clear: Effect.Effect<void>;
     }
   >() {}
   // TokenStoreLive: Layer that reads/writes the tokensAtom registry
   ```

7. **`StravaAuth` service** at `apps/shell/src/services/strava-auth.ts` — talks to the Cloudflare Worker via `HttpClient`. Decodes responses with `Schema`:
   ```typescript
   import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
   import { Context, Effect, Layer, Schema } from "effect";
   import { OAuthTokenResponse, OAuthExchangeFailed } from "@strava-overlay/shared";

   export class StravaAuth extends Context.Tag("StravaAuth")<
     StravaAuth,
     {
       readonly authorizeUrl: Effect.Effect<string>;
       readonly exchangeCode: (code: string) => Effect.Effect<OAuthTokenResponse, OAuthExchangeFailed>;
       readonly refresh: (refreshToken: string) => Effect.Effect<OAuthTokenResponse, OAuthExchangeFailed>;
     }
   >() {}

   export const StravaAuthLive = Layer.effect(
     StravaAuth,
     Effect.gen(function* () {
       const http = yield* HttpClient.HttpClient;
       const workerUrl = import.meta.env.VITE_OAUTH_WORKER_URL;

       const post = (path: "/exchange" | "/refresh", body: object) =>
         HttpClientRequest.post(`${workerUrl}${path}`).pipe(
           HttpClientRequest.bodyUnsafeJson(body),
           http.execute,
           Effect.flatMap(HttpClientResponse.schemaBodyJson(OAuthTokenResponse)),
           Effect.mapError((cause) => new OAuthExchangeFailed({ cause }))
         );

       return StravaAuth.of({
         authorizeUrl: Effect.sync(() => buildAuthorizeUrl()),
         exchangeCode: (code) => post("/exchange", { code }),
         refresh: (refreshToken) => post("/refresh", { refresh_token: refreshToken }),
       });
     })
   );

   function buildAuthorizeUrl(): string {
     const params = new URLSearchParams({
       client_id: import.meta.env.VITE_STRAVA_CLIENT_ID,
       response_type: "code",
       redirect_uri: import.meta.env.VITE_REDIRECT_URI,
       approval_prompt: "auto",
       scope: "read,activity:read_all",
     });
     return `https://www.strava.com/oauth/authorize?${params}`;
   }
   ```

8. **`StravaClient` service** at `apps/shell/src/services/strava-client.ts` — direct browser → Strava calls. Auto-refreshes expired tokens by depending on `TokenStore` + `StravaAuth`:
   ```typescript
   import { HttpClient, HttpClientRequest, HttpClientResponse } from "@effect/platform";
   import { Context, Effect, Layer, Schedule, Schema } from "effect";
   import { SummaryActivity, DetailedActivity, StravaApiError, StravaTokenExpired, StravaRateLimited, StravaSchemaError } from "@strava-overlay/shared";

   export class StravaClient extends Context.Tag("StravaClient")<
     StravaClient,
     {
       readonly listActivities: (page: number) =>
         Effect.Effect<readonly SummaryActivity[], StravaApiError | StravaTokenExpired | StravaRateLimited | StravaSchemaError>;
       readonly getActivity: (id: number) =>
         Effect.Effect<DetailedActivity, StravaApiError | StravaTokenExpired | StravaRateLimited | StravaSchemaError>;
     }
   >() {}

   export const StravaClientLive = Layer.effect(
     StravaClient,
     Effect.gen(function* () {
       const http = yield* HttpClient.HttpClient;
       const tokens = yield* TokenStore;
       const auth = yield* StravaAuth;

       // Acquire a valid access token, refreshing if within 60s of expiry
       const withValidToken = <A, E>(
         f: (token: string) => Effect.Effect<A, E>
       ): Effect.Effect<A, E | StravaTokenExpired | OAuthExchangeFailed> =>
         Effect.gen(function* () {
           const t = yield* tokens.get;
           const fresh = t.expiresAt - 60 > Date.now() / 1000
             ? t
             : yield* auth.refresh(t.refreshToken).pipe(
                 Effect.tap((resp) =>
                   tokens.set({
                     accessToken: resp.access_token,
                     refreshToken: resp.refresh_token,
                     expiresAt: resp.expires_at,
                   })
                 ),
                 Effect.map((resp) => ({
                   accessToken: resp.access_token,
                   refreshToken: resp.refresh_token,
                   expiresAt: resp.expires_at,
                 }))
               );
           return yield* f(fresh.accessToken);
         });

       const get = <A, I>(endpoint: string, schema: Schema.Schema<A, I>) =>
         withValidToken((token) =>
           HttpClientRequest.get(`https://www.strava.com/api/v3${endpoint}`).pipe(
             HttpClientRequest.bearerToken(token),
             http.execute,
             Effect.flatMap((res) => {
               if (res.status === 401) return Effect.fail(new StravaTokenExpired({ expiredAt: Date.now() / 1000 }));
               if (res.status === 429) {
                 const retry = Number(res.headers["retry-after"] ?? "60");
                 return Effect.fail(new StravaRateLimited({ retryAfterSeconds: retry }));
               }
               if (res.status >= 400) {
                 return Effect.flatMap(res.text, (body) =>
                   Effect.fail(new StravaApiError({ status: res.status, endpoint, body }))
                 );
               }
               return HttpClientResponse.schemaBodyJson(schema)(res).pipe(
                 Effect.mapError((cause) => new StravaSchemaError({ endpoint, cause }))
               );
             }),
             // Auto-retry on rate limit with the server-suggested delay
             Effect.retry({
               schedule: Schedule.exponential("1 second").pipe(Schedule.compose(Schedule.recurs(3))),
               while: (e) => e._tag === "StravaRateLimited",
             })
           )
         );

       return StravaClient.of({
         listActivities: (page) =>
           get(`/athlete/activities?page=${page}&per_page=30`, Schema.Array(SummaryActivity)),
         getActivity: (id) => get(`/activities/${id}`, DetailedActivity),
       });
     })
   );
   ```

9. **Runtime layer** at `apps/shell/src/runtime.ts`:
   ```typescript
   import { Atom } from "@effect-atom/atom-react";
   import { FetchHttpClient } from "@effect/platform";
   import { Layer } from "effect";
   import { TokenStoreLive } from "./services/token-store";
   import { StravaAuthLive } from "./services/strava-auth";
   import { StravaClientLive } from "./services/strava-client";

   const AppLayer = Layer.mergeAll(
     FetchHttpClient.layer,
     TokenStoreLive,
     StravaAuthLive,
   ).pipe(Layer.provideMerge(StravaClientLive));

   export const runtimeAtom = Atom.runtime(AppLayer);
   ```

10. **Routes** (using `react-router-dom`). Components consume Atoms only — no `useEffect` for data, no `useState` for shared state:
    - `/` → Home: reads `tokensAtom`. If null, shows "Connect with Strava" button. If present, redirects to `/activities`.
    - `/callback` → reads `code` from query, dispatches `exchangeCodeAtom` (a `runtimeAtom.fn` that calls `StravaAuth.exchangeCode` and writes the result via `TokenStore.set`), redirects on success.
    - `/activities` → renders `<ActivityPicker />` which `useAtomValue(activitiesAtom)` where `activitiesAtom = runtimeAtom.atom(Effect.gen(... yield* StravaClient.listActivities(1)))`. Returns a `Result<A, E>` rendered via `Result.builder(...).onSuccess(...).onFailure(...)`.
    - `/editor` → placeholder for now. In Phase 6 this loads the federated remote.

11. **ActivityPicker UI**: card grid using `Result.builder` for loading/error/success states. Selecting calls `getActivityAtom` (a `runtimeAtom.fn(id => StravaClient.getActivity(id))`) and writes to `selectedActivityAtom`.

**Acceptance criteria:**
- [ ] Click "Connect with Strava" → Strava authorize page → approve → redirected back → see activity list
- [ ] Tokens persist across page reloads within the same browser tab (sessionStorage via `Atom.kvs`)
- [ ] Tokens auto-refresh via Worker when expired — test by setting `expiresAt` to past and triggering an API call
- [ ] Activity list shows real activities from your account
- [ ] All Strava responses pass `Schema.decodeUnknown`. Tampering with the response (mock a missing field) yields a `StravaSchemaError`, not a runtime crash
- [ ] Forced 429 from Strava is retried with the Retry-After delay
- [ ] No `client_secret` appears anywhere in browser-shipped code (verify with build output search)
- [ ] **NO `useEffect` hook anywhere in this phase's code** (search the diff). Data loading goes through Atoms.
- [ ] **NO raw `fetch` calls anywhere** (search the diff). HTTP goes through `@effect/platform`.

**Anti-patterns:**
- ❌ Do NOT put `client_secret` in any frontend env var or code
- ❌ Do NOT proxy all Strava calls through the Worker. Worker is only for token exchange. Activity listing goes browser → Strava direct.
- ❌ Do NOT call `listActivities` to get the full polyline — only `getActivity(id)` returns the full polyline. The list endpoint returns `summary_polyline` only.
- ❌ Do NOT use `useEffect` to trigger data loading. That violates §1.5.6. Use an Atom backed by an Effect.
- ❌ Do NOT cast Strava responses with `as`. Decode with the Schema defined in step 3.

---

### Phase 5 — Wire Strava Data Into Editor (still no federation)

**Goal:** When user selects an activity and navigates to `/editor`, the editor pre-populates with that activity's data. User can choose a template that auto-creates overlays from the activity.

**Tasks:**

1. The `/editor` route in shell now mounts the editor **as a regular local import** for now (federation comes in Phase 6). Easiest way: temporarily symlink or use path import. **Better approach for this phase:** add the editor as a workspace dependency to the shell:
   ```bash
   cd apps/shell
   pnpm add overlay-editor@workspace:*
   ```
   Then `import { Editor } from 'overlay-editor'`. Make sure `overlay-editor/package.json` has correct `"main"` / `"exports"` pointing to the `Editor` component.

2. `Editor` component accepts props:
   ```typescript
   type EditorProps = {
     activity: DetailedActivity;
     athlete: Athlete;
   };
   ```
   On mount, the editor seeds its store from these props. Photo is initially empty (user uploads one).

3. Add a "Choose Template" panel. Two templates to ship:
   - **Strava Classic** — top-aligned stats grid (Distance, Pace, Time, Elevation, Power, Calories) in white sans-serif over photo, like Image 1
   - **Sore Style** — minimalist black-and-white with running club branding and route trace overlaid, like Image 2

   Each template is a function `(activity, athlete) => OverlayElement[]` that returns the initial overlay set. User can edit freely after applying.

4. Wire `RouteOverlay.polyline` to `activity.map.polyline` (the full polyline, not summary). If null/empty (some activities are private or trainer activities), hide the route option with a helpful message.

5. Format helpers in `packages/shared/src/utils/format.ts`:
   - `formatDistance(meters)` → "21.33 km" or "13.25 mi"
   - `formatPace(metersPerSecond, sportType)` → "5:02 /km" for runs, "32.1 km/h" for rides
   - `formatDuration(seconds)` → "1:47:19"
   - `formatElevation(meters)` → "71 m"

**Acceptance criteria:**
- [ ] User flow: Connect Strava → pick activity → editor opens with that activity's data available
- [ ] Applying "Strava Classic" template creates overlays populated with real numbers from the activity
- [ ] Applying "Sore Style" template creates the alternate layout with the route polyline visible
- [ ] Uploading a photo composites correctly with the templated overlays
- [ ] Exported PNG shows the templated overlays at native image resolution

**Anti-patterns:**
- ❌ Do NOT hard-code unit systems. Use the athlete's `measurement_preference` field ("feet" or "meters") to pick imperial/metric.
- ❌ Do NOT silently fail when polyline is missing — show a "this activity has no route data" message.

---

### Phase 6 — Module Federation Split

**Goal:** `overlay-editor` becomes a remote, loaded at runtime by `shell`. Replace the workspace import from Phase 5 with a dynamic federation import.

**Tasks:**

1. Install federation plugin in shell and editor:
   ```bash
   pnpm --filter shell add -D @originjs/vite-plugin-federation
   pnpm --filter overlay-editor add -D @originjs/vite-plugin-federation
   ```

2. `apps/overlay-editor/vite.config.ts`:
   ```typescript
   import { defineConfig } from 'vite';
   import react from '@vitejs/plugin-react';
   import federation from '@originjs/vite-plugin-federation';

   export default defineConfig({
     plugins: [
       react(),
       federation({
         name: 'overlayEditor',
         filename: 'remoteEntry.js',
         exposes: {
           './Editor': './src/Editor.tsx',
         },
         shared: ['react', 'react-dom', 'effect', '@effect-atom/atom-react', '@effect/platform'],
       }),
     ],
     build: {
       target: 'esnext',
       minify: false,        // helps debugging federation issues
       cssCodeSplit: false,  // single CSS bundle to avoid load-order issues
     },
     server: {
       port: 3001,
       strictPort: true,
       cors: true,
     },
     preview: {
       port: 3001,
       strictPort: true,
     },
   });
   ```

3. `apps/shell/vite.config.ts`:
   ```typescript
   federation({
     name: 'shell',
     remotes: {
       overlayEditor: process.env.VITE_OVERLAY_EDITOR_URL || 'http://localhost:3001/assets/remoteEntry.js',
     },
     shared: ['react', 'react-dom', 'effect', '@effect-atom/atom-react', '@effect/platform'],
   })
   ```
   Same `build.target: 'esnext'`, `cssCodeSplit: false`.

4. In shell, replace the workspace import with a lazy federated import:
   ```typescript
   const Editor = lazy(() => import('overlayEditor/Editor'));
   ```
   Remove `overlay-editor` from shell's `package.json` dependencies — it's no longer a build-time dep.

5. Add TypeScript ambient declarations at `apps/shell/src/remotes.d.ts`:
   ```typescript
   declare module 'overlayEditor/Editor' {
     import type { Activity, Athlete } from '@strava-overlay/shared';
     const Editor: React.ComponentType<{ activity: Activity; athlete: Athlete }>;
     export default Editor;
   }
   ```

6. Local dev:
   ```bash
   # Terminal 1
   pnpm --filter overlay-editor build && pnpm --filter overlay-editor preview
   # Terminal 2
   pnpm --filter shell dev
   ```
   **Important:** federation only works against a built remote (`preview`), not `dev` server. Dev-on-dev federation has issues with `@originjs/vite-plugin-federation`. Live with this — it's a known limitation.

7. Update Netlify env vars:
   - Shell site: `VITE_OVERLAY_EDITOR_URL = https://overlay-editor.netlify.app/assets/remoteEntry.js`
   - All sites: confirm CORS allows the shell's domain (Netlify serves with permissive CORS by default for static assets, but verify)

**Acceptance criteria:**
- [ ] Editor builds with a generated `remoteEntry.js` at `dist/assets/remoteEntry.js`
- [ ] Shell loads the editor at runtime — Network tab shows fetch of `remoteEntry.js` from the editor's URL
- [ ] User flow end-to-end still works: connect → pick activity → editor loads → export PNG at native resolution
- [ ] Editor still runs standalone at port 3001 (its `main.tsx` wraps `Editor` with a dev harness)
- [ ] Deployed: shell on shell.netlify.app loads editor from editor.netlify.app at runtime

**Anti-patterns:**
- ❌ Do NOT try to use `vite dev` for both shell and editor simultaneously — federation needs the built `remoteEntry.js`. Use `preview` for the remote.
- ❌ Do NOT share `@strava-overlay/shared` via federation. It's a build-time package, imported into each app's bundle separately. Federation `shared` is for runtime singletons (React, Effect runtime), not source packages.
- ❌ Do NOT add more than ~5 entries to federation `shared`. Each shared dep adds runtime negotiation cost. React, react-dom, effect, @effect-atom/atom-react, @effect/platform only — these MUST be shared per §1.5.8 so service Layers provided in shell satisfy Atoms in remotes.

---

### Phase 7 — Design History (BYOK Firebase, Conditional Remote)

**Goal:** Optional remote that loads only if user provides their own Firebase config. Demonstrates conditional MFE loading — the killer architectural talking point.

**Tasks:**

1. `apps/design-history` setup mirrors editor:
   ```bash
   cd apps/design-history
   pnpm add firebase
   pnpm add -D @originjs/vite-plugin-federation
   ```

2. `vite.config.ts` exposes `./DesignHistory` from `src/DesignHistory.tsx`.

3. BYOK setup component (`src/components/ByokSetup.tsx`):
   - Textarea where user pastes their Firebase config JSON (from Firebase Console → Project Settings → Your apps → Config)
   - Validates required fields: `apiKey`, `authDomain`, `projectId`
   - Stores in `localStorage` under key `sos-byok-firebase`
   - Shows a "starter security rules" snippet:
     ```
     rules_version = '2';
     service cloud.firestore {
       match /databases/{database}/documents {
         match /designs/{userId}/items/{designId} {
           allow read, write: if request.auth.uid == userId;
         }
       }
     }
     ```

4. `src/lib/firebase-byok.ts`:
   - `initFromStorage()` — reads localStorage, returns initialized Firebase app or null
   - `saveDesign(design)` — writes to `designs/{anonymousUid}/items/{designId}`
   - `listDesigns()`, `loadDesign(id)`, `deleteDesign(id)`

   For the MVP, use **Firebase Anonymous Auth** so the user doesn't have to sign in twice. `signInAnonymously` returns a `uid` that's stable for that browser+Firebase-project combo.

5. In shell, conditionally load the history remote:
   ```typescript
   const hasFirebase = Boolean(localStorage.getItem('sos-byok-firebase'));

   const DesignHistory = hasFirebase
     ? lazy(() => import('designHistory/DesignHistory'))
     : null;
   ```
   Route `/history` shows `<DesignHistory />` if available, else shows the BYOK setup screen.

6. From the editor, add a "Save to History" button that's enabled only if BYOK is configured. Saving serializes:
   ```typescript
   {
     id: string;
     createdAt: timestamp;
     activityId: number;
     activityName: string;
     overlays: OverlayElement[];
     // NOT the source image — that stays local. We save the design metadata only.
     thumbnailDataUrl: string; // small preview, generated by exporting a downscaled version
   }
   ```

**Acceptance criteria:**
- [ ] If no BYOK configured, `/history` shows setup screen and `designHistory` remote is NOT fetched (verify in Network tab)
- [ ] After pasting Firebase config, `/history` works and remote is loaded
- [ ] Saving a design writes to the user's Firebase
- [ ] Re-opening a saved design restores the overlay set in the editor
- [ ] Clearing localStorage removes BYOK access; no data leaks across users

**Anti-patterns:**
- ❌ Do NOT save the source image to Firebase. It's the user's photo, kept local. Save design metadata + thumbnail only.
- ❌ Do NOT validate Firebase keys by hitting Firebase ourselves — let the user's own Firebase reject bad config. We are not a proxy.
- ❌ Do NOT show example Firebase configs that look real (avoid `firebase: "AIzaSy..."` style — use clear placeholders).

---

### Phase 8 — GitHub Actions: Path-Filtered Independent Deploys

**Goal:** Each deploy target has its own workflow that runs only when its own code (or shared dependencies) change. This is the mechanism that makes "single monorepo, independent deploys" actually work.

**Required GitHub secrets** (set in repo Settings → Secrets and variables → Actions):

| Secret | Where it comes from | Used by |
|---|---|---|
| `NETLIFY_AUTH_TOKEN` | Netlify user settings → Applications → Personal access tokens | shell/editor/history workflows |
| `NETLIFY_SHELL_SITE_ID` | Netlify shell site → Site configuration → Site ID | deploy-shell.yml |
| `NETLIFY_EDITOR_SITE_ID` | Netlify editor site → Site configuration → Site ID | deploy-editor.yml |
| `NETLIFY_HISTORY_SITE_ID` | Netlify history site → Site configuration → Site ID | deploy-history.yml |
| `CLOUDFLARE_API_TOKEN` | Cloudflare dashboard → My Profile → API Tokens → Create token (Edit Cloudflare Workers template) | deploy-worker.yml |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare dashboard → Workers & Pages → right sidebar | deploy-worker.yml |

**Tasks:**

1. **Disable Netlify's auto-build from Git for all three sites.** Go to each site → Build & deploy → Continuous deployment → Build settings → "Stop builds". We're driving deploys from GitHub Actions instead so we control path filtering. Netlify still hosts; it just doesn't auto-build on push.

2. `.github/workflows/ci.yml` — runs on every PR to catch breakage early:
   ```yaml
   name: CI
   on:
     pull_request:
     push:
       branches: [main]

   jobs:
     verify:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
           with:
             version: 9
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - run: pnpm typecheck
         - run: pnpm lint
         - run: pnpm build
   ```

3. `.github/workflows/deploy-shell.yml`:
   ```yaml
   name: Deploy Shell
   on:
     push:
       branches: [main]
       paths:
         - 'apps/shell/**'
         - 'packages/shared/**'
         - 'pnpm-lock.yaml'
         - '.github/workflows/deploy-shell.yml'

   jobs:
     deploy:
       runs-on: ubuntu-latest
       steps:
         - uses: actions/checkout@v4
         - uses: pnpm/action-setup@v4
           with: { version: 9 }
         - uses: actions/setup-node@v4
           with:
             node-version: 20
             cache: pnpm
         - run: pnpm install --frozen-lockfile
         - name: Build shell
           run: pnpm --filter shell build
           env:
             VITE_STRAVA_CLIENT_ID: ${{ vars.STRAVA_CLIENT_ID }}
             VITE_OAUTH_WORKER_URL: ${{ vars.OAUTH_WORKER_URL }}
             VITE_REDIRECT_URI: ${{ vars.SHELL_REDIRECT_URI }}
             VITE_OVERLAY_EDITOR_URL: ${{ vars.OVERLAY_EDITOR_URL }}
             VITE_DESIGN_HISTORY_URL: ${{ vars.DESIGN_HISTORY_URL }}
         - name: Deploy to Netlify
           uses: nwtgck/actions-netlify@v3
           with:
             publish-dir: apps/shell/dist
             production-deploy: true
             github-token: ${{ secrets.GITHUB_TOKEN }}
             deploy-message: ${{ github.event.head_commit.message }}
           env:
             NETLIFY_AUTH_TOKEN: ${{ secrets.NETLIFY_AUTH_TOKEN }}
             NETLIFY_SITE_ID: ${{ secrets.NETLIFY_SHELL_SITE_ID }}
   ```

4. `.github/workflows/deploy-editor.yml` and `deploy-history.yml` follow the same pattern with their own paths, site IDs, and `--filter` targets. Editor and history do NOT need the shell's `VITE_*` env vars at build time.

5. `.github/workflows/deploy-worker.yml`:
   ```yaml
   name: Deploy Auth Worker
   on:
     push:
       branches: [main]
       paths:
         - 'auth-worker/**'
         - 'packages/shared/src/types/strava.ts'
         - '.github/workflows/deploy-worker.yml'

   jobs:
     deploy:
       runs-on: ubuntu-latest
       defaults:
         run:
           working-directory: auth-worker
       steps:
         - uses: actions/checkout@v4
         - uses: actions/setup-node@v4
           with:
             node-version: 20
         - run: npm ci
         - name: Deploy with Wrangler
           uses: cloudflare/wrangler-action@v3
           with:
             apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
             accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
             workingDirectory: auth-worker
             # Secrets (CLIENT_ID, CLIENT_SECRET) set via `wrangler secret put` once,
             # they persist across deploys — do NOT set them in this workflow.
   ```

6. **Use repo `vars` (not `secrets`) for non-sensitive values** like URLs and the public `STRAVA_CLIENT_ID`. Settings → Secrets and variables → Actions → Variables tab. Keeps the secrets list focused on actual secrets.

7. **Verification dance:**
   - Make a PR that touches only `apps/shell/src/main.tsx` → confirm only `deploy-shell` runs on merge
   - Make a PR that touches only `auth-worker/src/index.ts` → confirm only `deploy-worker` runs on merge
   - Make a PR that touches `packages/shared/src/types/strava.ts` → confirm shell, editor, history, AND worker all redeploy (this type is shared by all)

**Acceptance criteria:**
- [ ] All five workflows exist and pass syntax check (push them, check Actions tab)
- [ ] A shell-only change deploys only the shell
- [ ] A worker-only change deploys only the worker
- [ ] A shared-types change deploys everything that imports those types
- [ ] CI workflow runs on every PR and blocks merge if typecheck/lint/build fail
- [ ] Branch protection rule enabled on `main`: require CI to pass before merge

**Anti-patterns:**
- ❌ Do NOT trigger deploys on every push regardless of path. The whole point of in-monorepo independent deploys is path filtering.
- ❌ Do NOT put OAuth secrets (`STRAVA_CLIENT_SECRET`) in GitHub Actions secrets. They live in Cloudflare via `wrangler secret put`. GitHub Actions only needs the Cloudflare API token to deploy the worker code, not to set the worker's runtime secrets.
- ❌ Do NOT use `branches: [main]` AND a manual trigger without `workflow_dispatch:` — you'll lose the ability to redeploy without a code change.
- ❌ Do NOT skip the `pnpm-lock.yaml` path in deploy triggers. A pure dependency update (no source change) should still redeploy.

---

### Phase 9 — Polish

**Goal:** Make it feel like a product, not a demo.

**Tasks (in priority order, skip what doesn't fit your time):**

1. Loading states everywhere: federation load, Strava fetch, export rendering
2. Error boundaries around each remote — if a remote fails, the shell stays alive
3. Keyboard shortcuts in editor: delete, duplicate, arrow-nudge, undo/redo
4. Mobile-responsive editor (or graceful "use a desktop" message)
5. Better typography choices (Inter, Bricolage Grotesque) loaded via fontsource
6. Two more templates to make the gallery feel substantial
7. README with architecture diagram, decisions log, and screenshots
8. A 60-second Loom demoing the flow end-to-end

---

## 4. Interview Talking Points Reference

When the work is done, these are the architectural decisions to be ready to discuss. Build with these talking points in mind:

| Point | What to say |
|---|---|
| Why MFE for this | "Editor is heavy (canvas lib, route rendering). Splitting it as a remote keeps the auth/marketing surface light. Different concerns, different deploy cadence." |
| Why BYOK | "Zero database on my side = zero GDPR liability. Users own their data, can take it anywhere, can revoke instantly. Costs scale with users, not with my budget." |
| Why CF Worker | "Strava doesn't support PKCE. `client_secret` must live server-side. CF Worker is the smallest possible server — stateless, edge, free. Everything else stays in browser." |
| Why lossless export | "Display canvas is at viewport resolution; export needs native resolution. Two-pass: edit on small canvas using relative coords, render to offscreen Konva stage at native pixels for export. Same pattern as Figma's export pipeline." |
| Why Konva over Fabric | "Konva's `pixelRatio` on `toDataURL` and proactive memory management for long sessions. Better React DX with react-konva." |
| Why conditional remote | "Design history is only relevant for users who provisioned BYOK. Loading the remote unconditionally would download dead code for the 80% of users who just want to export and go. Runtime-conditional federation matches the embedder-as-customer pattern." |
| Why Effect-TS | "Three reasons. One: every error path is in the type signature — `Effect<A, StravaTokenExpired \| StravaRateLimited \| StravaSchemaError>` is exhaustively narrowed by the compiler at every catch site. Two: cancellation is automatic — when a component unmounts mid-fetch, the Effect is interrupted and the network request is aborted. With raw fetch + useEffect, this is a footgun I'd have to remember every time. Three: services + layers gives me dependency injection without a framework. The Strava client is a service; in tests I provide a mock layer; in prod I provide the real layer. No mocking libraries, no monkey-patching." |
| Why Atom over Zustand | "Zustand is excellent, but adding Effect for HTTP and then Zustand for state means two systems with different cancellation models. Atom is Effect-native — an Atom backed by an Effect inherits the Effect's interruption, retry, and error semantics. One mental model end to end." |
| Why Schema for API responses | "Strava's API is versioned externally. If they add or rename a field, raw `as DetailedActivity` casts give me a runtime crash three components deep. `Schema.decodeUnknown` fails at the network boundary with a structured error I can show in the UI. Defense in depth, costs ~100µs per response." |

---

## 5. Out of Scope (Do Not Build)

- Backend database or accounts
- Stripe / payments
- Social sharing (just exporting a PNG is enough)
- Mobile native app
- Video export
- Multi-user editing
- Embedding our editor in other sites (would re-introduce the iframe vs federation question)
- Strava webhook handling
- Activity import from other platforms (Garmin, Polar, etc)

---

## 6. Definition of Done

The project is done when **all** of the following are true:

- [ ] Three Netlify sites deployed, all green
- [ ] One Cloudflare Worker deployed, manual OAuth round-trip works
- [ ] Full user flow works in production: visit shell URL → connect Strava → pick activity → editor loads (from a different origin) → upload photo → apply template → tweak overlays → export PNG at native resolution
- [ ] BYOK Firebase flow works: paste config → save design → reload page → load design
- [ ] Bundle inspection confirms no `client_secret` shipped to browser
- [ ] All apps pass `pnpm typecheck` and `pnpm build` with zero errors
- [ ] **Effect compliance check passes** — run `pnpm run check:effect` which greps the source for forbidden patterns:
  ```bash
  # apps/*/src and packages/shared/src must NOT contain:
  # - Bare `fetch(` calls (allowed only inside @effect/platform wrappers)
  # - `useState` for shared state (use Atom)
  # - `useEffect(() => {` followed by any async pattern
  # - `Promise.all(` (use Effect.all)
  # - `.then(` or `.catch(` chains
  # - ` as ` casts on API response variables
  # The grep script lives in scripts/check-effect.sh; add it to CI
  ```
- [ ] README has: architecture diagram, decisions log, three live URLs, screenshots, 60-second demo video link

When all checkboxes are true, the project ships.
