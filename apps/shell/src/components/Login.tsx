// Login screen: a single button that redirects to Strava's authorize page.
// No client state needed - the buildAuthorizeUrl helper reads env on demand.
import { buildAuthorizeUrl } from "../lib/oauth";

export function Login() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 text-neutral-100">
      <div className="max-w-md text-center">
        <h1 className="mb-3 text-3xl font-bold tracking-tight">
          🏃 Strava Overlay Studio
        </h1>
        <p className="mb-8 text-neutral-400">
          Turn your activities into shareable photo overlays.
        </p>
        <a
          href={buildAuthorizeUrl()}
          className="inline-flex items-center gap-2 rounded-md bg-[#fc5200] px-5 py-3 font-semibold text-white shadow-lg transition hover:bg-[#e34a00]"
        >
          Connect with Strava
        </a>
        <p className="mt-6 text-xs text-neutral-500">
          We request <code>read</code> and <code>activity:read_all</code>{" "}
          scopes. Your access token lives only in this tab's sessionStorage.
        </p>
      </div>
    </main>
  );
}
