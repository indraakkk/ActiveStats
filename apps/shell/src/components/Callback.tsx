// OAuth callback handler. Strava redirects here with ?code=... after the
// user approves. We dispatch the worker exchange via an Atom.fn so the
// Effect inherits cancellation if the user navigates away mid-flight.
// On success the session lands in sessionAtom and App.tsx routes away.
import { useEffect, useState } from "react";
import { Effect } from "effect";
import { useAtomSet } from "@effect-atom/atom-react";
import { runtimeAtom } from "../runtime";
import { sessionAtom } from "../store/session-store";
import { exchangeCode } from "../lib/oauth";

// runtimeAtom.fn yields an AtomResultFn. We use the promiseExit mode so
// the dispatcher returns an Exit we can branch on synchronously in the
// click handler.
const exchangeAtom = runtimeAtom.fn(
  Effect.fnUntraced(function* (code: string, ctx) {
    const session = yield* exchangeCode(code);
    ctx.set(sessionAtom, session);
    return session;
  })
);

export function Callback() {
  const exchange = useAtomSet(exchangeAtom, { mode: "promiseExit" });
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const oauthError = params.get("error");

    if (oauthError) {
      setError(`Strava denied access: ${oauthError}`);
      return;
    }
    if (!code) {
      setError("No authorization code in the callback URL.");
      return;
    }

    let cancelled = false;
    exchange(code).then((exit) => {
      if (cancelled) return;
      if (exit._tag === "Success") {
        // Land on the home route once the session is persisted.
        window.history.replaceState(null, "", "/");
        // App.tsx re-renders on sessionAtom change; force a re-evaluation
        // by issuing a popstate so the router branch in App picks it up.
        window.dispatchEvent(new PopStateEvent("popstate"));
      } else {
        setError(`Token exchange failed: ${String(exit.cause)}`);
      }
    });
    return () => {
      cancelled = true;
    };
    // exchange is stable across renders (Atom-bound dispatcher).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="max-w-md text-center">
        {error ? (
          <>
            <h2 className="mb-2 text-xl font-semibold text-red-300">
              Login failed
            </h2>
            <p className="mb-4 text-sm text-neutral-400">{error}</p>
            <a
              href="/"
              className="rounded border border-neutral-700 px-4 py-2 text-sm hover:bg-neutral-800"
            >
              Try again
            </a>
          </>
        ) : (
          <>
            <div className="mb-3 text-2xl">⏳</div>
            <p className="text-sm text-neutral-400">
              Exchanging your Strava code for a session…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
