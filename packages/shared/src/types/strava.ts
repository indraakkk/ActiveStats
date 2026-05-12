// Schemas for Strava API responses. Defined here (not in auth-worker, not in
// each app) so the worker and all three frontends validate against the SAME
// shape — schema drift surfaces once, at the network boundary.
//
// Phase 2 added Athlete + OAuthTokenResponse (worker validates Strava's
// token response). Phase 4 adds SummaryActivity for the activity picker.
import { Schema } from "effect";

export const Athlete = Schema.Struct({
  id: Schema.Number,
  firstname: Schema.String,
  lastname: Schema.String,
  profile: Schema.String,
  measurement_preference: Schema.Literal("feet", "meters"),
});
export type Athlete = typeof Athlete.Type;

export const OAuthTokenResponse = Schema.Struct({
  access_token: Schema.String,
  refresh_token: Schema.String,
  expires_at: Schema.Number,
  athlete: Athlete,
});
export type OAuthTokenResponse = typeof OAuthTokenResponse.Type;

// The persisted session shape is structurally identical to the OAuth token
// response — the shell stashes it in sessionStorage verbatim and refreshes
// in place when access_token expires.
export const Session = OAuthTokenResponse;
export type Session = OAuthTokenResponse;

// SummaryActivity: the shape of items in GET /athlete/activities. Strava
// returns far more fields than we list here; Schema.Struct (without
// onExcessProperty: "ignore") drops anything not declared. Adding fields
// later is additive — old persisted data still decodes.
//
// Notes on fields used by Phase 5 templates:
// - distance is metres, moving_time/elapsed_time are seconds
// - average_speed is m/s
// - map.summary_polyline is Google-encoded; we decode it for route overlays
// - sport_type is the newer, more granular categorisation (e.g. "TrailRun")
export const ActivityMap = Schema.Struct({
  id: Schema.String,
  summary_polyline: Schema.NullishOr(Schema.String),
});
export type ActivityMap = typeof ActivityMap.Type;

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
  start_date_local: Schema.String,
  timezone: Schema.String,
  average_speed: Schema.Number,
  max_speed: Schema.Number,
  has_heartrate: Schema.Boolean,
  average_heartrate: Schema.optional(Schema.Number),
  max_heartrate: Schema.optional(Schema.Number),
  average_cadence: Schema.optional(Schema.Number),
  average_watts: Schema.optional(Schema.Number),
  kudos_count: Schema.Number,
  map: ActivityMap,
});
export type SummaryActivity = typeof SummaryActivity.Type;

