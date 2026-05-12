// OAuth helpers: build the Strava authorize URL, exchange a code for tokens
// (via our Cloudflare Worker), and refresh tokens. The worker holds the
// client_secret; the browser holds only the public client_id.
//
// Strava's OAuth flow:
//   1. Shell redirects to strava.com/oauth/authorize?... with client_id,
//      redirect_uri (pre-registered), and scopes.
//   2. Strava redirects back to redirect_uri?code=<short-lived-code>.
//   3. Callback.tsx POSTs the code to the worker's /exchange.
//   4. Worker adds client_secret, calls Strava, validates the response
//      against OAuthTokenResponse, returns the validated session JSON.

import { Data, Effect } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
  HttpClientResponse,
} from "@effect/platform";
import { OAuthTokenResponse, type Session } from "@strava-overlay/shared";
import { env } from "./env";

export class OAuthError extends Data.TaggedError("OAuthError")<{
  readonly phase: "exchange" | "refresh";
  readonly status: number;
  readonly body: string;
}> {}

export const STRAVA_SCOPES = "read,activity:read_all";

export const buildAuthorizeUrl = (): string => {
  const url = new URL("https://www.strava.com/oauth/authorize");
  url.searchParams.set("client_id", env.STRAVA_CLIENT_ID);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", env.REDIRECT_URI);
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", STRAVA_SCOPES);
  return url.toString();
};

const postToWorker = (
  phase: "exchange" | "refresh",
  body: unknown
): Effect.Effect<Session, OAuthError> => {
  const path = phase === "exchange" ? "/exchange" : "/refresh";
  return Effect.gen(function* () {
    const http = yield* HttpClient.HttpClient;
    const req = yield* HttpClientRequest.post(
      `${env.OAUTH_WORKER_URL}${path}`
    ).pipe(HttpClientRequest.bodyJson(body));
    const res = yield* http.execute(req);
    if (res.status >= 400) {
      const text = yield* res.text;
      return yield* Effect.fail(
        new OAuthError({ phase, status: res.status, body: text })
      );
    }
    return yield* HttpClientResponse.schemaBodyJson(OAuthTokenResponse)(res);
  }).pipe(
    // Any non-OAuthError failure (HttpClientError, HttpBodyError,
    // ParseError) collapses to OAuthError with status 0 so the caller
    // only has one tagged failure shape to match against.
    Effect.catchAll((cause) =>
      cause instanceof OAuthError
        ? Effect.fail(cause)
        : Effect.fail(new OAuthError({ phase, status: 0, body: String(cause) }))
    ),
    Effect.scoped,
    Effect.provide(FetchHttpClient.layer)
  );
};

export const exchangeCode = (code: string) => postToWorker("exchange", { code });

export const refreshTokens = (refreshToken: string) =>
  postToWorker("refresh", { refresh_token: refreshToken });
