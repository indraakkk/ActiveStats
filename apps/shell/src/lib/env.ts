// VITE-time env vars. Validated at module load so a missing/empty value
// fails loudly during dev/build instead of producing mystery OAuth errors
// later. All three are required for OAuth to function.
//
// Set them in apps/shell/.env.local (gitignored). See .env.example.

const read = (name: string): string => {
  const v = (import.meta.env as Record<string, string | undefined>)[name];
  if (!v || v.trim() === "") {
    throw new Error(
      `Missing required env var ${name} - see apps/shell/.env.example`
    );
  }
  return v;
};

export const env = {
  STRAVA_CLIENT_ID: read("VITE_STRAVA_CLIENT_ID"),
  OAUTH_WORKER_URL: read("VITE_OAUTH_WORKER_URL"),
  REDIRECT_URI: read("VITE_REDIRECT_URI"),
} as const;
