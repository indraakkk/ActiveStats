// Cloudflare Worker that exchanges Strava OAuth `code` (or refreshes a
// refresh_token) for tokens. Stateless — no KV, no D1, no cache. The only
// reason this server exists is that Strava requires `client_secret` and
// doesn't support PKCE, so the secret must live somewhere other than the
// browser. Everything else is browser → Strava direct.
//
// Per SPEC §1.5.x: all async/HTTP/error flow runs in Effect; failures are
// tagged errors; the response shape is validated against the shared Schema
// before being forwarded to the frontend (defense in depth — if Strava
// changes their wire format we surface it here, not three components deep
// in the React app).

import { Data, Effect, Schema } from "effect";
import {
  FetchHttpClient,
  HttpClient,
  HttpClientRequest,
} from "@effect/platform";
import { OAuthTokenResponse } from "@strava-overlay/shared";

export interface Env {
  STRAVA_CLIENT_ID: string;
  STRAVA_CLIENT_SECRET: string;
  ALLOWED_ORIGINS: string;
}

// Tagged errors per §1.5.2 — every failure path is in the type signature.
class BadRequest extends Data.TaggedError("BadRequest")<{
  readonly message: string;
}> {}

class StravaUpstreamError extends Data.TaggedError("StravaUpstreamError")<{
  readonly status: number;
  readonly body: string;
}> {}

class StravaResponseSchemaError extends Data.TaggedError(
  "StravaResponseSchemaError"
)<{
  readonly cause: unknown;
}> {}

// Request body Schemas — runtime-validated, no `as` casts.
const ExchangeBody = Schema.Struct({ code: Schema.String });
const RefreshBody = Schema.Struct({ refresh_token: Schema.String });

function corsHeaders(
  origin: string | null,
  allowed: readonly string[]
): Record<string, string> {
  const allowOrigin =
    origin && allowed.includes(origin) ? origin : allowed[0];
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

const jsonResponse = (
  data: unknown,
  status: number,
  cors: Record<string, string>
): Response =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

const handle = (request: Request, env: Env): Effect.Effect<Response> => {
  const origin = request.headers.get("Origin");
  const allowed = env.ALLOWED_ORIGINS.split(",").map((s) => s.trim());
  const cors = corsHeaders(origin, allowed);

  if (request.method === "OPTIONS") {
    return Effect.succeed(new Response(null, { headers: cors }));
  }
  if (request.method !== "POST") {
    return Effect.succeed(
      new Response("Method not allowed", { status: 405, headers: cors })
    );
  }

  const program = Effect.gen(function* () {
    const url = new URL(request.url);

    const raw = yield* Effect.tryPromise({
      try: () => request.json(),
      catch: () => new BadRequest({ message: "Invalid JSON" }),
    });

    const params = new URLSearchParams({
      client_id: env.STRAVA_CLIENT_ID,
      client_secret: env.STRAVA_CLIENT_SECRET,
    });

    if (url.pathname === "/exchange") {
      const body = yield* Schema.decodeUnknown(ExchangeBody)(raw).pipe(
        Effect.mapError(() => new BadRequest({ message: "Missing code" }))
      );
      params.set("code", body.code);
      params.set("grant_type", "authorization_code");
    } else if (url.pathname === "/refresh") {
      const body = yield* Schema.decodeUnknown(RefreshBody)(raw).pipe(
        Effect.mapError(
          () => new BadRequest({ message: "Missing refresh_token" })
        )
      );
      params.set("refresh_token", body.refresh_token);
      params.set("grant_type", "refresh_token");
    } else {
      return yield* Effect.fail(new BadRequest({ message: "Unknown route" }));
    }

    const http = yield* HttpClient.HttpClient;
    const stravaRes = yield* HttpClientRequest.post(
      "https://www.strava.com/oauth/token"
    ).pipe(HttpClientRequest.bodyUrlParams(params), http.execute);

    const text = yield* stravaRes.text;

    if (stravaRes.status >= 400) {
      return yield* Effect.fail(
        new StravaUpstreamError({ status: stravaRes.status, body: text })
      );
    }

    // Validate Strava's response against the shared Schema before forwarding.
    // If Strava changes the wire format, this is where it surfaces.
    const parsed = yield* Effect.try({
      try: (): unknown => JSON.parse(text),
      catch: (cause) => new StravaResponseSchemaError({ cause }),
    });
    const validated = yield* Schema.decodeUnknown(OAuthTokenResponse)(
      parsed
    ).pipe(
      Effect.mapError((cause) => new StravaResponseSchemaError({ cause }))
    );

    return jsonResponse(validated, 200, cors);
  });

  return program.pipe(
    Effect.catchTag("BadRequest", (e) =>
      Effect.succeed(jsonResponse({ error: e.message }, 400, cors))
    ),
    Effect.catchTag("StravaUpstreamError", (e) =>
      Effect.succeed(
        jsonResponse(
          { error: "Upstream failed", status: e.status },
          502,
          cors
        )
      )
    ),
    Effect.catchTag("StravaResponseSchemaError", () =>
      Effect.succeed(
        jsonResponse(
          { error: "Unexpected response shape from Strava" },
          502,
          cors
        )
      )
    ),
    // Any remaining typed errors (HttpClient transport errors, etc.) → 502.
    // Without this catch-all runPromise would reject and CF Workers would
    // emit a generic 500 with no body. Spec only specifies catchAllDefect,
    // but that catches throws, not typed failures.
    Effect.catchAll(() =>
      Effect.succeed(jsonResponse({ error: "Upstream unreachable" }, 502, cors))
    ),
    Effect.catchAllDefect(() =>
      Effect.succeed(jsonResponse({ error: "Unexpected" }, 500, cors))
    ),
    Effect.scoped,
    Effect.provide(FetchHttpClient.layer)
  );
};

export default {
  fetch(request: Request, env: Env): Promise<Response> {
    return Effect.runPromise(handle(request, env));
  },
};
