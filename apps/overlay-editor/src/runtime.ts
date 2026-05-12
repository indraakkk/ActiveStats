// Effect runtime for the overlay editor. The export pipeline is the only
// Effect-shaped consumer right now (image load can fail, Konva render is
// sync-but-fallible). Including FetchHttpClient.layer up front so when
// Phase 5 wires Strava data into templates, no plumbing change is needed.
import { Atom } from "@effect-atom/atom-react";
import { FetchHttpClient } from "@effect/platform";

export const runtimeAtom = Atom.runtime(FetchHttpClient.layer);
