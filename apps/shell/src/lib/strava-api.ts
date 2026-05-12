// Typed Strava API client. Currently only fetches the activity list;
// Phase 5 will add detailed-activity + streams endpoints.
//
// 401 handling lives in the derived atoms (session-store), not here — this
// module just surfaces UnauthorizedError as a tagged failure and lets the
// caller decide whether to refresh and retry.
import { Data, Effect, Schema } from "effect";
import {
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { SummaryActivity } from "@strava-overlay/shared";

export class UnauthorizedError extends Data.TaggedError(
  "UnauthorizedError"
)<{}> {}

export class StravaApiError extends Data.TaggedError("StravaApiError")<{
  readonly status: number;
  readonly body: string;
  readonly endpoint: string;
}> {}

const SummaryActivityArray = Schema.Array(SummaryActivity);

export const fetchActivities = (accessToken: string, perPage = 30) => {
  const endpoint = `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`;
  return Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const res = yield* http.execute(
      HttpClientRequest.get(endpoint).pipe(
        HttpClientRequest.bearerToken(accessToken)
      )
    );
    if (res.status === 401) {
      return yield* Effect.fail(new UnauthorizedError());
    }
    if (res.status >= 400) {
      const body = yield* res.text;
      return yield* Effect.fail(
        new StravaApiError({ status: res.status, body, endpoint })
      );
    }
    return yield* HttpClientResponse.schemaBodyJson(SummaryActivityArray)(res);
  }).pipe(
    // Collapse transport/schema/scope errors into StravaApiError so the
    // caller's union is just our two tagged shapes — the UI can branch
    // on _tag without inspecting unfamiliar Effect-platform types.
    Effect.mapError((cause): UnauthorizedError | StravaApiError => {
      if (cause instanceof UnauthorizedError) return cause;
      if (cause instanceof StravaApiError) return cause;
      return new StravaApiError({ status: 0, body: String(cause), endpoint });
    })
  );
};
