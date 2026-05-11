// Schemas for Strava API responses. Defined here (not in auth-worker, not in
// each app) so the worker and all three frontends validate against the SAME
// shape — schema drift surfaces once, at the network boundary.
//
// Phase 2 needs only Athlete + OAuthTokenResponse (the worker validates
// Strava's token response). Phase 4 will extend this file with
// SummaryActivity / DetailedActivity for the activity picker.
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
