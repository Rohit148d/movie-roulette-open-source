import "server-only";
import { readCache, writeCache } from "@/lib/tmdb/cache";
import type { TmdbConfig } from "@/lib/tmdb/config";
import {
  AppError,
  tmdbInvalidCredentials,
  tmdbRateLimited,
  tmdbTimeout,
  tmdbUnavailable,
} from "@/lib/tmdb/errors";

export interface TmdbRequestOptions {
  /** Cache successful responses for this long. 0 disables caching. */
  ttlMs?: number;
  /** Timeout for a single network attempt. */
  timeoutMs?: number;
  /** Number of retries after the first attempt (GET requests are idempotent). */
  retries?: number;
  /** Hard budget for the whole call, including retries and backoff. */
  deadlineMs?: number;
  signal?: AbortSignal;
}

export type QueryValue = string | number | boolean | null | undefined;

export interface TmdbClientOptions {
  config: TmdbConfig;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  defaultTimeoutMs?: number;
  defaultRetries?: number;
  defaultDeadlineMs?: number;
}

const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 2;
const DEFAULT_DEADLINE_MS = 12_000;

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === null || value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  return search.toString();
}

function parseRetryAfter(value: string | null): number {
  if (!value) return 1;
  const seconds = Number(value);
  if (Number.isFinite(seconds) && seconds >= 0) return Math.ceil(seconds);
  const date = Date.parse(value);
  if (Number.isFinite(date)) {
    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
  }
  return 1;
}

export class TmdbClient {
  private readonly config: TmdbConfig;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly defaultTimeoutMs: number;
  private readonly defaultRetries: number;
  private readonly defaultDeadlineMs: number;

  constructor(options: TmdbClientOptions) {
    this.config = options.config;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.defaultTimeoutMs = options.defaultTimeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.defaultRetries = options.defaultRetries ?? DEFAULT_RETRIES;
    this.defaultDeadlineMs = options.defaultDeadlineMs ?? DEFAULT_DEADLINE_MS;
  }

  async get<T>(
    path: string,
    params: Record<string, QueryValue> = {},
    options: TmdbRequestOptions = {},
  ): Promise<T> {
    if (this.config.mode !== "live") {
      throw new AppError(
        "TMDB_NOT_CONFIGURED",
        503,
        "TMDB is not configured on this server. Add TMDB_READ_ACCESS_TOKEN to the environment and restart.",
      );
    }

    const ttlMs = options.ttlMs ?? 0;
    const cacheKey = `${this.config.baseUrl}${path}?${buildQuery(params)}`;
    if (ttlMs > 0) {
      const cached = readCache<T>(cacheKey, this.now());
      if (cached !== undefined) return cached;
    }

    const query = new URLSearchParams(buildQuery(params));
    if (this.config.apiKey && !this.config.token) query.set("api_key", this.config.apiKey);
    const url = `${this.config.baseUrl}${path}${query.size > 0 ? `?${query.toString()}` : ""}`;

    const headers: Record<string, string> = { Accept: "application/json" };
    if (this.config.token) headers.Authorization = `Bearer ${this.config.token}`;

    const timeoutMs = options.timeoutMs ?? this.defaultTimeoutMs;
    const retries = options.retries ?? this.defaultRetries;
    const deadlineMs = options.deadlineMs ?? this.defaultDeadlineMs;
    const startedAt = this.now();
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt += 1) {
      const elapsed = this.now() - startedAt;
      const remaining = deadlineMs - elapsed;
      if (remaining <= 0) {
        throw lastError instanceof AppError ? lastError : tmdbTimeout(lastError);
      }

      const controller = new AbortController();
      const onExternalAbort = () => controller.abort(options.signal?.reason);
      if (options.signal) {
        if (options.signal.aborted) throw options.signal.reason;
        options.signal.addEventListener("abort", onExternalAbort, { once: true });
      }
      const timer = setTimeout(
        () => controller.abort(new DOMException("TMDB request timed out", "TimeoutError")),
        Math.min(timeoutMs, remaining),
      );

      try {
        const response = await this.fetchImpl(url, {
          method: "GET",
          headers,
          signal: controller.signal,
          cache: "no-store",
        });
        const retryAfterSeconds = parseRetryAfter(response.headers.get("retry-after"));

        if (response.status === 401 || response.status === 403) {
          throw tmdbInvalidCredentials();
        }

        if (response.status === 404) {
          throw new AppError("TMDB_NOT_FOUND", 404, "That movie could not be found.");
        }

        if (response.status === 429) {
          if (attempt < retries) {
            lastError = tmdbRateLimited(retryAfterSeconds);
            const delay = Math.min(retryAfterSeconds * 1000, 1_500);
            if (this.now() - startedAt + delay < deadlineMs) {
              await this.sleep(delay);
              continue;
            }
          }
          throw tmdbRateLimited(retryAfterSeconds);
        }

        if (response.status >= 500) {
          lastError = tmdbUnavailable();
          if (attempt < retries) {
            const delay = Math.min(250 * 2 ** attempt + Math.random() * 150, 1_500);
            if (this.now() - startedAt + delay < deadlineMs) {
              await this.sleep(delay);
              continue;
            }
          }
          throw lastError;
        }

        if (!response.ok) {
          throw tmdbUnavailable();
        }

        let data: T;
        try {
          data = (await response.json()) as T;
        } catch (error) {
          lastError = tmdbUnavailable(error);
          if (attempt < retries) {
            await this.sleep(Math.min(250 * 2 ** attempt, 1_000));
            continue;
          }
          throw lastError;
        }

        if (ttlMs > 0) writeCache(cacheKey, data, ttlMs, this.now());
        return data;
      } catch (error) {
        if (options.signal?.aborted) throw options.signal.reason;

        if (error instanceof AppError && error.code !== "TMDB_UNAVAILABLE") {
          throw error;
        }

        const abortedByTimeout = controller.signal.aborted;
        lastError = abortedByTimeout ? tmdbTimeout(error) : (error ?? tmdbUnavailable());
        if (attempt < retries) {
          const delay = Math.min(250 * 2 ** attempt + Math.random() * 150, 1_500);
          if (this.now() - startedAt + delay < deadlineMs) {
            await this.sleep(delay);
            continue;
          }
        }
        throw abortedByTimeout ? tmdbTimeout(error) : tmdbUnavailable(error);
      } finally {
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", onExternalAbort);
      }
    }

    throw lastError instanceof AppError ? lastError : tmdbUnavailable(lastError);
  }
}
