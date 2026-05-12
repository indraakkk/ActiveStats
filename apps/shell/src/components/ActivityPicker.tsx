// Activity picker. Reads activitiesAtom (a Result-typed derived effect
// atom that re-runs when the session changes) and renders one of:
//   - Loading skeleton (initial / refreshing)
//   - Error with retry button
//   - Empty state
//   - List of activities, click to select
//
// Selection state goes into selectedActivityIdAtom. Phase 5 will read it
// to drive template-based overlay generation.
import { Result, useAtom, useAtomRefresh, useAtomValue } from "@effect-atom/atom-react";
import type { SummaryActivity } from "@strava-overlay/shared";
import {
  activitiesAtom,
  athleteAtom,
  selectedActivityIdAtom,
  sessionAtom,
} from "../store/session-store";

export function ActivityPicker() {
  const activitiesResult = useAtomValue(activitiesAtom);
  const refresh = useAtomRefresh(activitiesAtom);
  const athlete = useAtomValue(athleteAtom);
  const [selectedId, setSelectedId] = useAtom(selectedActivityIdAtom);
  const setSession = useAtom(sessionAtom)[1];

  const onLogout = () => setSession(null);

  return (
    <main className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="flex items-center justify-between border-b border-neutral-800 px-6 py-3">
        <div className="flex items-center gap-3">
          {athlete?.profile && (
            <img
              src={athlete.profile}
              alt=""
              className="h-8 w-8 rounded-full"
            />
          )}
          <div className="text-sm">
            <p className="font-semibold">
              {athlete ? `${athlete.firstname} ${athlete.lastname}` : "Loading…"}
            </p>
            <p className="text-xs text-neutral-500">Strava Overlay Studio</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={refresh}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Refresh
          </button>
          <button
            type="button"
            onClick={onLogout}
            className="rounded border border-neutral-700 px-3 py-1 text-sm hover:bg-neutral-800"
          >
            Log out
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-6 py-8">
        <h2 className="mb-4 text-lg font-semibold">Pick an activity</h2>
        {Result.builder(activitiesResult)
          .onInitial(() => <ActivityListSkeleton />)
          .onErrorTag("UnauthorizedError", () => (
            <ErrorPanel
              message="Your Strava session expired. Please log in again."
              actionLabel="Log in"
              onAction={() => setSession(null)}
            />
          ))
          .onErrorTag("OAuthError", (e) => (
            <ErrorPanel
              message={`Token refresh failed (HTTP ${e.status}). ${e.body || ""}`}
              actionLabel="Retry"
              onAction={refresh}
            />
          ))
          .onErrorTag("StravaApiError", (e) => (
            <ErrorPanel
              message={`Strava API error (HTTP ${e.status}).`}
              actionLabel="Retry"
              onAction={refresh}
            />
          ))
          .onSuccess((activities) =>
            activities.length === 0 ? (
              <p className="text-neutral-500">
                No recent activities found on this account.
              </p>
            ) : (
              <ul className="divide-y divide-neutral-800 rounded border border-neutral-800">
                {activities.map((a) => (
                  <ActivityRow
                    key={a.id}
                    activity={a}
                    isSelected={selectedId === a.id}
                    onSelect={() => setSelectedId(a.id)}
                  />
                ))}
              </ul>
            )
          )
          .render()}
      </section>
    </main>
  );
}

function ActivityRow({
  activity,
  isSelected,
  onSelect,
}: {
  activity: SummaryActivity;
  isSelected: boolean;
  onSelect: () => void;
}) {
  const km = (activity.distance / 1000).toFixed(2);
  const minutes = Math.floor(activity.moving_time / 60);
  const seconds = activity.moving_time % 60;
  const time = `${minutes}:${String(seconds).padStart(2, "0")}`;
  const date = new Date(activity.start_date_local).toLocaleDateString();
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        className={`flex w-full items-center gap-4 px-4 py-3 text-left transition ${
          isSelected
            ? "bg-[#fc5200]/15 ring-1 ring-inset ring-[#fc5200]/50"
            : "hover:bg-neutral-900"
        }`}
      >
        <div className="flex-1">
          <p className="font-medium">{activity.name}</p>
          <p className="text-xs text-neutral-500">
            {activity.sport_type} · {date}
          </p>
        </div>
        <div className="text-right text-sm">
          <p className="font-mono">{km} km</p>
          <p className="text-xs text-neutral-500">{time}</p>
        </div>
      </button>
    </li>
  );
}

function ActivityListSkeleton() {
  return (
    <ul className="space-y-2">
      {Array.from({ length: 5 }).map((_, i) => (
        <li
          key={i}
          className="h-14 animate-pulse rounded border border-neutral-800 bg-neutral-900"
        />
      ))}
    </ul>
  );
}

function ErrorPanel({
  message,
  actionLabel,
  onAction,
}: {
  message: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded border border-red-900/60 bg-red-950/30 p-4 text-sm">
      <p className="mb-3 text-red-200">{message}</p>
      <button
        type="button"
        onClick={onAction}
        className="rounded bg-red-900/40 px-3 py-1.5 font-semibold text-red-100 hover:bg-red-900/60"
      >
        {actionLabel}
      </button>
    </div>
  );
}
