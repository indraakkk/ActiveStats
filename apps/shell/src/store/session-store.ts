// OAuth session + derived activity feed.
//
// sessionAtom: Atom.kvs-backed Writable<Session | null>. Persists to
//   sessionStorage via the runtime's KeyValueStore layer. Default null
//   (logged out). Set by Callback after a successful /exchange; cleared
//   by logout.
//
// activitiesAtom: runtimeAtom.atom that reads sessionAtom reactively. When
//   the session is present, it fetches /athlete/activities. On 401 it
//   tries to refresh the token via the worker, persists the new session
//   back, and retries once. The result is exposed as Result<Activity[], E>
//   — components consume via useAtomValue + Result.match.
//
// selectedActivityIdAtom: just a Writable<number | null>. Phase 5 wires
//   this into template-driven overlay generation.
import { Atom } from "@effect-atom/atom-react";
import { Effect, Schema } from "effect";
import { Session } from "@strava-overlay/shared";
import { runtimeAtom } from "../runtime";
import { fetchActivities } from "../lib/strava-api";
import { refreshTokens } from "../lib/oauth";

const NullableSession = Schema.NullOr(Session);

export const sessionAtom = Atom.kvs({
  runtime: runtimeAtom,
  key: "strava-session",
  schema: NullableSession,
  defaultValue: (): Session | null => null,
});

export const isAuthenticatedAtom = Atom.make((get) => get(sessionAtom) !== null);

export const athleteAtom = Atom.make((get) => {
  const s = get(sessionAtom);
  return s?.athlete ?? null;
});

export const selectedActivityIdAtom = Atom.make<number | null>(null);

// Derived effect-atom: re-runs whenever sessionAtom changes. The runtime
// supplies HttpClient + KeyValueStore so we don't need to provide them
// here. Errors are surfaced as Result.Failure with tagged unions
// (UnauthorizedError | StravaApiError | OAuthError) for the UI to match.
export const activitiesAtom = runtimeAtom.atom((get) => {
  const session = get(sessionAtom);
  if (!session) return Effect.succeed([]);
  return fetchActivities(session.access_token).pipe(
    // On 401, refresh tokens once, persist the new session, retry. If
    // refresh itself fails, the user sees an error and is offered a
    // logout/retry.
    Effect.catchTag("UnauthorizedError", () =>
      refreshTokens(session.refresh_token).pipe(
        Effect.tap((newSession) =>
          Effect.sync(() => get.set(sessionAtom, newSession))
        ),
        Effect.flatMap((newSession) =>
          fetchActivities(newSession.access_token)
        )
      )
    )
  );
});
