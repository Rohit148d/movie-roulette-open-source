import "server-only";
import type { Filters } from "@/lib/filters";
import { filterSignature } from "@/lib/filters";
import { readTmdbConfig } from "@/lib/tmdb/config";
import {
  AppError,
  poolExhausted,
  tmdbNotConfigured,
} from "@/lib/tmdb/errors";
import { TmdbClient } from "@/lib/tmdb/client";
import { demoFindRandomMovie } from "@/lib/tmdb/demo";
import {
  buildDiscoverParams,
  isCandidateAllowed,
  pickRandomPage,
  secureRng,
  shuffled,
  toMovie,
  verifyMovie,
  type Rng,
} from "@/lib/tmdb/discover";
import type {
  RandomMovieResult,
  TmdbDiscoverResponse,
  TmdbMovieDetails,
  TmdbDiscoverResult,
} from "@/lib/tmdb/types";

const POOL_METADATA_TTL_MS = 5 * 60 * 1000;
const DISCOVER_PAGE_TTL_MS = 2 * 60 * 1000;
const MOVIE_DETAILS_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CANDIDATES_TO_VERIFY = 9;
const DETAIL_BATCH_SIZE = 3;

export interface FindRandomMovieOptions {
  rng?: Rng;
  client?: TmdbClient;
  signal?: AbortSignal;
}

async function loadDetails(
  client: TmdbClient,
  id: number,
  signal?: AbortSignal,
): Promise<TmdbMovieDetails | null> {
  try {
    return await client.get<TmdbMovieDetails>(
      `/movie/${id}`,
      // `videos` rides along on the detail call, so the trailer costs no
      // extra upstream request and is cached with the movie for 6 hours.
      { language: "en-US", append_to_response: "credits,videos" },
      {
        ttlMs: MOVIE_DETAILS_TTL_MS,
        retries: 1,
        deadlineMs: 10_000,
        signal,
      },
    );
  } catch (error) {
    if (error instanceof AppError && error.code === "TMDB_NOT_FOUND") return null;
    throw error;
  }
}

/**
 * Live TMDB path, separated for tests that inject a client.
 */
export async function findRandomMovieWithClient(
  client: TmdbClient,
  filters: Filters,
  excludeIds: readonly number[] = [],
  options: { rng?: Rng; signal?: AbortSignal } = {},
): Promise<RandomMovieResult> {
  const rng = options.rng ?? secureRng;
  const excluded = new Set(excludeIds);

  const firstPage = await client.get<TmdbDiscoverResponse>(
    "/discover/movie",
    buildDiscoverParams(filters, 1),
    {
      ttlMs: POOL_METADATA_TTL_MS,
      retries: 2,
      deadlineMs: 14_000,
      signal: options.signal,
    },
  );

  if (!Array.isArray(firstPage.results)) {
    throw new AppError("TMDB_UNAVAILABLE", 502, "TMDB returned an unexpected response.");
  }

  if (firstPage.total_results === 0) {
    throw poolExhausted(
      "No movies match these filters. Try opening up the year range, runtime or genres.",
      {
        totalResults: 0,
        excludedCount: excludeIds.length,
        scannedPages: 1,
        reason: "no_results",
      },
    );
  }

  const totalPages = Math.max(1, Math.min(firstPage.total_pages || 1, 500));
  const candidates = new Map<number, TmdbDiscoverResult>();
  const pagesUsed = [1];

  const addCandidates = (results: TmdbDiscoverResult[]) => {
    for (const candidate of results) {
      if (isCandidateAllowed(candidate, excluded)) {
        candidates.set(candidate.id, candidate);
      }
    }
  };

  addCandidates(firstPage.results);

  // Sample several random pages, not just page one. The first page is always
  // requested to learn the size of the eligible pool, but it is only one of
  // the pages that can contribute candidates.
  while (pagesUsed.length < 8) {
    if (candidates.size >= 24) break;
    if (candidates.size > 0 && pagesUsed.length >= 4) break;

    const page = pickRandomPage(totalPages, filters, rng, pagesUsed);
    if (pagesUsed.includes(page)) break;
    pagesUsed.push(page);

    const response = await client.get<TmdbDiscoverResponse>(
      "/discover/movie",
      buildDiscoverParams(filters, page),
      {
        ttlMs: DISCOVER_PAGE_TTL_MS,
        retries: 1,
        deadlineMs: 12_000,
        signal: options.signal,
      },
    );
    if (Array.isArray(response.results)) addCandidates(response.results);
  }

  if (candidates.size === 0) {
    throw poolExhausted(
      "Every movie on the sampled pages is already in this session. Start a new session or widen your filters.",
      {
        totalResults: firstPage.total_results,
        excludedCount: excludeIds.length,
        scannedPages: pagesUsed.length,
        reason: "all_seen",
      },
    );
  }

  const ordered = shuffled([...candidates.values()], rng).slice(0, MAX_CANDIDATES_TO_VERIFY);
  let attempts = 0;
  const rejectionReasons = new Set<string>();

  for (let start = 0; start < ordered.length; start += DETAIL_BATCH_SIZE) {
    const batch = ordered.slice(start, start + DETAIL_BATCH_SIZE);
    const details = await Promise.all(
      batch.map((candidate) => loadDetails(client, candidate.id, options.signal)),
    );

    for (let index = 0; index < details.length; index += 1) {
      const detail = details[index];
      if (!detail || detail.id !== batch[index].id) continue;
      attempts += 1;
      const outcome = verifyMovie(detail, filters);
      if (outcome.valid) {
        return {
          movie: toMovie(detail),
          pool: {
            totalResults: firstPage.total_results,
            totalPages: firstPage.total_pages,
            eligiblePages: totalPages,
            scannedPages: pagesUsed.length,
          },
          attempts,
          source: "live",
        };
      }
      outcome.reasons.forEach((reason) => rejectionReasons.add(reason));
    }
  }

  const reasonSummary = [...rejectionReasons].join(", ");
  if (reasonSummary) {
    console.warn(`[tmdb] candidates rejected after verification: ${reasonSummary}`);
  }

  throw poolExhausted(
    "TMDB returned movies, but none passed every selected filter. Try widening the runtime, rating or year range.",
    {
      totalResults: firstPage.total_results,
      excludedCount: excludeIds.length,
      scannedPages: pagesUsed.length,
      attempts,
      reason: "verification_failed",
    },
  );
}

/** Public entry point used by the API route. */
export async function findRandomMovie(
  filters: Filters,
  excludeIds: readonly number[] = [],
  options: FindRandomMovieOptions = {},
): Promise<RandomMovieResult> {
  const config = readTmdbConfig();
  if (config.mode === "demo") {
    return demoFindRandomMovie(filters, excludeIds, options.rng ?? secureRng);
  }
  if (config.mode === "unconfigured") {
    throw tmdbNotConfigured();
  }

  const client = options.client ?? new TmdbClient({ config });
  return findRandomMovieWithClient(client, filters, excludeIds, {
    rng: options.rng,
    signal: options.signal,
  });
}

export function tmdbMode(): "live" | "demo" | "unconfigured" {
  return readTmdbConfig().mode;
}

export { filterSignature };
