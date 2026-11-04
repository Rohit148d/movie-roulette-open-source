export type AppErrorCode =
  | "INVALID_FILTERS"
  | "RATE_LIMITED"
  | "TMDB_NOT_CONFIGURED"
  | "TMDB_INVALID_CREDENTIALS"
  | "TMDB_RATE_LIMITED"
  | "TMDB_TIMEOUT"
  | "TMDB_UNAVAILABLE"
  | "TMDB_NOT_FOUND"
  | "POOL_EXHAUSTED";

export interface AppErrorOptions {
  retryAfterSeconds?: number;
  details?: Record<string, unknown>;
  cause?: unknown;
}

/**
 * An error that is safe to serialize to the browser. Raw TMDB responses and
 * credentials must never be attached to this object.
 */
export class AppError extends Error {
  readonly code: AppErrorCode;
  readonly status: number;
  readonly publicMessage: string;
  readonly retryAfterSeconds?: number;
  readonly details?: Record<string, unknown>;

  constructor(
    code: AppErrorCode,
    status: number,
    publicMessage: string,
    options: AppErrorOptions = {},
  ) {
    super(publicMessage, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = "AppError";
    this.code = code;
    this.status = status;
    this.publicMessage = publicMessage;
    this.retryAfterSeconds = options.retryAfterSeconds;
    this.details = options.details;
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

export function poolExhausted(
  message = "No unseen movies match these filters. Widen your filters or start a new session.",
  details?: Record<string, unknown>,
): AppError {
  return new AppError("POOL_EXHAUSTED", 404, message, { details });
}

export function tmdbTimeout(cause?: unknown): AppError {
  return new AppError(
    "TMDB_TIMEOUT",
    504,
    "TMDB took too long to respond. Please spin again in a moment.",
    { cause },
  );
}

export function tmdbUnavailable(cause?: unknown): AppError {
  return new AppError(
    "TMDB_UNAVAILABLE",
    503,
    "TMDB is temporarily unavailable. Please try again shortly.",
    { cause },
  );
}

export function tmdbRateLimited(retryAfterSeconds: number, cause?: unknown): AppError {
  return new AppError(
    "TMDB_RATE_LIMITED",
    429,
    "TMDB is rate-limiting requests right now. Please try again in a few seconds.",
    { retryAfterSeconds, cause },
  );
}

export function tmdbInvalidCredentials(cause?: unknown): AppError {
  return new AppError(
    "TMDB_INVALID_CREDENTIALS",
    502,
    "TMDB rejected the server credentials. Check that TMDB_READ_ACCESS_TOKEN is a valid v4 read access token.",
    { cause },
  );
}

export function tmdbNotConfigured(): AppError {
  return new AppError(
    "TMDB_NOT_CONFIGURED",
    503,
    "TMDB is not configured on this server. Add TMDB_READ_ACCESS_TOKEN to the environment and restart.",
  );
}
