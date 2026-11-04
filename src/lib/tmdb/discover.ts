import type { Filters } from "@/lib/filters";
import { filterSignature } from "@/lib/filters";
import type {
  Movie,
  MovieTrailer,
  TmdbDiscoverResult,
  TmdbMovieDetails,
  TmdbVideo,
} from "@/lib/tmdb/types";

export type Rng = () => number;

const IMAGE_BASE = "https://image.tmdb.org/t/p";

/** Cryptographically seeded randomness keeps movie picks from being predictable. */
export function secureRng(): number {
  const values = new Uint32Array(1);
  globalThis.crypto.getRandomValues(values);
  return values[0] / 2 ** 32;
}

export function buildDiscoverParams(
  filters: Filters,
  page: number,
): Record<string, string | number | boolean> {
  const params: Record<string, string | number | boolean> = {
    page: Math.max(1, Math.min(Math.trunc(page), 500)),
    include_adult: false,
    include_video: false,
    language: "en-US",
    sort_by: "popularity.desc",
    "primary_release_date.gte": `${filters.yearFrom}-01-01`,
    "primary_release_date.lte": `${filters.yearTo}-12-31`,
    "vote_average.gte": filters.minRating,
    "vote_count.gte": filters.minVotes,
  };

  if (filters.genres.length > 0) {
    // TMDB treats comma-separated genre ids as AND: every selected genre must match.
    params.with_genres = [...filters.genres].sort((a, b) => a - b).join(",");
  }
  if (filters.language) params.with_original_language = filters.language;
  if (filters.runtimeMin !== null) params["with_runtime.gte"] = filters.runtimeMin;
  if (filters.runtimeMax !== null) params["with_runtime.lte"] = filters.runtimeMax;
  return params;
}

const PAGE_HISTORY_LIMIT = 8;
const pageHistory = new Map<string, number[]>();

function rememberPage(signature: string, page: number): void {
  const history = pageHistory.get(signature) ?? [];
  history.push(page);
  pageHistory.set(signature, history.slice(-PAGE_HISTORY_LIMIT));
  if (pageHistory.size > 100) {
    const oldest = pageHistory.keys().next().value;
    if (oldest !== undefined) pageHistory.delete(oldest);
  }
}

/**
 * Picks a random page across the entire result set (TMDB caps discover at 500
 * pages), avoiding the last few pages used for the same filters. This prevents
 * repeated spins from always sampling the popular first page.
 */
export function pickRandomPage(
  totalPages: number,
  filters: Filters,
  rng: Rng = secureRng,
  alreadyUsed: readonly number[] = [],
): number {
  const eligible = Math.max(1, Math.min(totalPages, 500));
  const signature = filterSignature(filters);
  const recent = new Set([...(pageHistory.get(signature) ?? []), ...alreadyUsed]);
  let candidates: number[] = [];
  for (let page = 1; page <= eligible; page += 1) {
    if (!recent.has(page)) candidates.push(page);
  }
  if (candidates.length === 0) {
    pageHistory.delete(signature);
    candidates = Array.from({ length: eligible }, (_, index) => index + 1).filter(
      (page) => !alreadyUsed.includes(page),
    );
  }
  if (candidates.length === 0) return 1;

  const index = Math.min(candidates.length - 1, Math.floor(rng() * candidates.length));
  const page = candidates[index];
  rememberPage(signature, page);
  return page;
}

export function shuffled<T>(items: readonly T[], rng: Rng = secureRng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.floor(rng() * (i + 1)));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export interface VerificationOutcome {
  valid: boolean;
  reasons: string[];
}

function releaseYear(releaseDate: string | undefined): number | null {
  if (!releaseDate) return null;
  const year = Number(releaseDate.slice(0, 4));
  return Number.isFinite(year) ? year : null;
}

/**
 * Independently verifies every selected filter against the movie detail
 * response. Discover's parameters do the heavy lifting, but this guard
 * catches missing runtime/date data and TMDB drift.
 */
export function verifyMovie(details: TmdbMovieDetails, filters: Filters): VerificationOutcome {
  const reasons: string[] = [];

  if (details.adult === true) reasons.push("adult");
  if (details.video === true) reasons.push("video");

  const year = releaseYear(details.release_date);
  if (year === null || year < filters.yearFrom || year > filters.yearTo) {
    reasons.push("release_year");
  }

  if (typeof details.vote_average !== "number" || details.vote_average < filters.minRating - 0.001) {
    reasons.push("rating");
  }

  if (typeof details.vote_count !== "number" || details.vote_count < filters.minVotes) {
    reasons.push("vote_count");
  }

  if (filters.runtimeMin !== null || filters.runtimeMax !== null) {
    if (typeof details.runtime !== "number" || details.runtime <= 0) {
      reasons.push("runtime_unknown");
    } else {
      if (filters.runtimeMin !== null && details.runtime < filters.runtimeMin) {
        reasons.push("runtime_min");
      }
      if (filters.runtimeMax !== null && details.runtime > filters.runtimeMax) {
        reasons.push("runtime_max");
      }
    }
  }

  if (filters.language && details.original_language !== filters.language) {
    reasons.push("language");
  }

  if (filters.genres.length > 0) {
    const detailGenres = new Set((details.genres ?? []).map((genre) => genre.id));
    if (!filters.genres.every((id) => detailGenres.has(id))) {
      reasons.push("genres");
    }
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Chooses the trailer TMDB itself labels as an official YouTube trailer.
 * Nothing is invented: when TMDB has no suitable video the movie simply has
 * no trailer and the UI hides the button.
 */
export function pickTrailer(videos: readonly TmdbVideo[] | undefined): MovieTrailer | null {
  if (!videos?.length) return null;

  const usable = videos.filter(
    (video) =>
      video.site?.toLowerCase() === "youtube" &&
      typeof video.key === "string" &&
      /^[A-Za-z0-9_-]{6,20}$/.test(video.key),
  );
  if (usable.length === 0) return null;

  const rank = (video: TmdbVideo): number => {
    let score = 0;
    if (video.type?.toLowerCase() === "trailer") score += 100;
    else if (video.type?.toLowerCase() === "teaser") score += 40;
    if (video.official === true) score += 20;
    if (video.iso_639_1 === "en") score += 10;
    return score;
  };

  const best = [...usable].sort((a, b) => rank(b) - rank(a))[0];
  if (rank(best) < 40) return null;

  const key = best.key as string;
  return {
    key,
    name: best.name?.trim() || "Official trailer",
    site: "YouTube",
    url: `https://www.youtube.com/watch?v=${key}`,
  };
}

export function toMovie(details: TmdbMovieDetails): Movie {
  const director =
    details.credits?.crew?.find((member) => member.job === "Director")?.name ?? null;
  const posterPath = details.poster_path ?? null;
  const backdropPath = details.backdrop_path ?? null;

  return {
    id: details.id,
    title: details.title,
    originalTitle: details.original_title || details.title,
    overview: details.overview?.trim() || "No synopsis has been written for this film yet.",
    tagline: details.tagline?.trim() || null,
    releaseDate: details.release_date || null,
    releaseYear: releaseYear(details.release_date),
    runtime: typeof details.runtime === "number" && details.runtime > 0 ? details.runtime : null,
    voteAverage: details.vote_average,
    voteCount: details.vote_count,
    genres: details.genres ?? [],
    language: details.original_language ?? "",
    director,
    posterUrl: posterPath ? `${IMAGE_BASE}/w500${posterPath}` : null,
    backdropUrl: backdropPath ? `${IMAGE_BASE}/w1280${backdropPath}` : null,
    tmdbUrl: `https://www.themoviedb.org/movie/${details.id}`,
    trailer: pickTrailer(details.videos?.results),
  };
}

export function isCandidateAllowed(candidate: TmdbDiscoverResult, excludeIds: ReadonlySet<number>): boolean {
  return (
    !excludeIds.has(candidate.id) &&
    candidate.adult !== true &&
    candidate.video !== true &&
    typeof candidate.id === "number"
  );
}

export function resetRandomnessForTests(): void {
  pageHistory.clear();
}
