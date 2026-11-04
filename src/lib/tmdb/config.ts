import "server-only";

export type TmdbMode = "live" | "demo" | "unconfigured";

export interface TmdbConfig {
  mode: TmdbMode;
  token?: string;
  apiKey?: string;
  baseUrl: string;
}

const DEFAULT_BASE_URL = "https://api.themoviedb.org/3";

function clean(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

function validateBaseUrl(raw: string | undefined): string {
  const value = raw ?? DEFAULT_BASE_URL;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("TMDB_API_BASE_URL is not a valid URL.");
  }
  const isLocalhost = parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1";
  if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && isLocalhost)) {
    throw new Error("TMDB_API_BASE_URL must use HTTPS (HTTP is only allowed for localhost tests).");
  }
  return value.replace(/\/+$/, "");
}

/**
 * Reads TMDB credentials on the server only. The token is never prefixed with
 * NEXT_PUBLIC and is never returned by an API route.
 */
export function readTmdbConfig(
  env: Record<string, string | undefined> = process.env,
): TmdbConfig {
  const demo = clean(env.TMDB_DEMO_MODE) === "true";
  if (demo) {
    return { mode: "demo", baseUrl: DEFAULT_BASE_URL };
  }

  const token = clean(env.TMDB_READ_ACCESS_TOKEN);
  const apiKey = clean(env.TMDB_API_KEY);
  if (!token && !apiKey) {
    return { mode: "unconfigured", baseUrl: DEFAULT_BASE_URL };
  }

  return {
    mode: "live",
    token,
    apiKey,
    baseUrl: validateBaseUrl(clean(env.TMDB_API_BASE_URL)),
  };
}

export function assertTmdbConfigured(config: TmdbConfig): void {
  if (config.mode === "unconfigured") {
    throw new Error("TMDB is not configured");
  }
}
