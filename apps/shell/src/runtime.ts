// Effect runtime for the shell. Two services baked in:
//   - FetchHttpClient.layer: typed HTTP via @effect/platform's fetch wrapper
//   - BrowserKeyValueStore.layerSessionStorage: backs Atom.kvs so the
//     OAuth session survives reloads within the tab but NOT across tabs/
//     restarts (spec preference — Strava tokens are short-lived and
//     re-auth is cheap; sessionStorage scopes the blast radius if a tab
//     ends up in the wrong hands).
//
// If we ever need cross-tab persistence we'd swap layerSessionStorage for
// layerLocalStorage. Nothing else has to change.
import { Atom } from "@effect-atom/atom-react";
import { FetchHttpClient } from "@effect/platform";
import { BrowserKeyValueStore } from "@effect/platform-browser";
import { Layer } from "effect";

export const runtimeAtom = Atom.runtime(
  Layer.mergeAll(
    FetchHttpClient.layer,
    BrowserKeyValueStore.layerSessionStorage
  )
);
