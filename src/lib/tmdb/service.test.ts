import { beforeEach, describe, expect, it, vi } from "vitest";
import { defaultFilters, type Filters } from "@/lib/filters";
import { AppError } from "@/lib/tmdb/errors";
import { resetRandomnessForTests } from "@/lib/tmdb/discover";
import { findRandomMovieWithClient } from "@/lib/tmdb/service";
import { TmdbClient } from "@/lib/tmdb/client";
import type {
  TmdbDiscoverResponse,
  TmdbDiscoverResult,
  TmdbMovieDetails,
} from "@/lib/tmdb/types";

const PER_PAGE = 20;

function candidate(page: number, index: number): TmdbDiscoverResult {
  return {
    id: page * 1_000 + index,
    title: `Candidate ${page}-${index}`,
    original_title: `Candidate ${page}-${index}`,
    overview: "",
    release_date: "2020-04-01",
    vote_average: 8.1,
    vote_count: 2_000,
    popularity: 50,
    genre_ids: [28],
    original_language: "en",
    poster_path: `/poster-${page}-${index}.jpg`,
    backdrop_path: null,
    adult: false,
    video: false,
  };
}

function movieDetails(id: number, overrides: Partial<TmdbMovieDetails> = {}): TmdbMovieDetails {
  // Every fifth candidate is intentionally too long for the runtime filter so
  // the service has to reject it and keep looking.
  const runtime = id % 5 === 0 ? 175 : 105;
  return {
    id,
    title: `Movie ${id}`,
    overview: "Something cinematic.",
    tagline: "A tagline",
    release_date: "2002-06-01",
    runtime,
    vote_average: 7.9,
    vote_count: 3_000,
    genres: [
      { id: 28, name: "Action" },
      { id: 53, name: "Thriller" },
    ],
    original_language: "en",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    credits: { crew: [{ job: "Director", name: "Someone" }] },
    ...overrides,
  };
}

function fakeClient(
  options: {
    totalResults?: number;
    totalPages?: number;
    details?: (id: number) => TmdbMovieDetails;
    pageResults?: (page: number) => TmdbDiscoverResult[];
  } = {},
) {
  const get = vi.fn(async (path: string, params: Record<string, unknown> = {}) => {
    if (path === "/discover/movie") {
      const page = Number(params.page ?? 1);
      const results =
        options.pageResults?.(page) ??
        Array.from({ length: PER_PAGE }, (_, index) => candidate(page, index));
      return {
        page,
        total_pages: options.totalPages ?? 5,
        total_results: options.totalResults ?? 100,
        results,
      } satisfies TmdbDiscoverResponse;
    }
    const match = /^\/movie\/(\d+)$/.exec(path);
    if (match) {
      const id = Number(match[1]);
      return (options.details ?? ((movieId: number) => movieDetails(movieId)))(id);
    }
    throw new Error(`Unexpected TMDB path: ${path}`);
  });
  return { client: { get } as unknown as TmdbClient, get };
}

const strictFilters: Filters = {
  ...defaultFilters(),
  genres: [28],
  language: "en",
  yearFrom: 2000,
  yearTo: 2005,
  minRating: 7.5,
  minVotes: 500,
  runtimeMin: 100,
  runtimeMax: 110,
};

beforeEach(() => {
  resetRandomnessForTests();
});

describe("findRandomMovieWithClient", () => {
  it("returns a movie and pool metadata", async () => {
    const { client } = fakeClient();
    const result = await findRandomMovieWithClient(client, defaultFilters(), [], { rng: () => 0 });

    expect(result.source).toBe("live");
    expect(result.movie.title).toMatch(/^Movie /);
    expect(result.pool).toMatchObject({ totalResults: 100, totalPages: 5, eligiblePages: 5 });
    expect(result.attempts).toBeGreaterThanOrEqual(1);
    expect(result.movie.posterUrl).toContain("https://image.tmdb.org");
  });

  it("only returns movies that satisfy every selected filter", async () => {
    const { client, get } = fakeClient();
    const result = await findRandomMovieWithClient(client, strictFilters, [], { rng: () => 0 });

    expect(result.movie.runtime).toBeGreaterThanOrEqual(100);
    expect(result.movie.runtime).toBeLessThanOrEqual(110);
    expect(result.movie.releaseYear).toBeGreaterThanOrEqual(2000);
    expect(result.movie.releaseYear).toBeLessThanOrEqual(2005);
    expect(result.movie.voteAverage).toBeGreaterThanOrEqual(7.5);
    expect(result.movie.voteCount).toBeGreaterThanOrEqual(500);
    expect(result.movie.language).toBe("en");
    expect(result.movie.genres.map((genre) => genre.id)).toContain(28);

    const discoverCall = get.mock.calls.find(([path]) => path === "/discover/movie");
    expect(discoverCall?.[1]).toMatchObject({
      "with_runtime.gte": 100,
      "with_runtime.lte": 110,
      "vote_average.gte": 7.5,
      with_genres: "28",
      with_original_language: "en",
    });
  });

  it("reports verification failure when TMDB returns movies outside the filters", async () => {
    const { client } = fakeClient({
      details: (id) => movieDetails(id, { runtime: 175 }),
    });

    await expect(
      findRandomMovieWithClient(client, strictFilters, [], { rng: () => 0 }),
    ).rejects.toMatchObject({
      code: "POOL_EXHAUSTED",
      status: 404,
      details: { reason: "verification_failed" },
    });
  });

  it("reports no results when the filter combination is empty", async () => {
    const { client } = fakeClient({ totalResults: 0, totalPages: 0 });
    await expect(
      findRandomMovieWithClient(client, strictFilters, [], { rng: () => 0 }),
    ).rejects.toMatchObject({
      code: "POOL_EXHAUSTED",
      details: { reason: "no_results", totalResults: 0 },
    });
  });

  it("reports all_seen when every sampled candidate is already in the session", async () => {
    const excludedIds = Array.from({ length: 5 }, (_, page) =>
      Array.from({ length: PER_PAGE }, (_, index) => candidate(page + 1, index).id),
    ).flat();
    const { client } = fakeClient({ totalPages: 5 });

    await expect(
      findRandomMovieWithClient(client, defaultFilters(), excludedIds, { rng: () => 0 }),
    ).rejects.toMatchObject({
      code: "POOL_EXHAUSTED",
      details: { reason: "all_seen" },
    });
  });

  it("skips candidates that vanish from TMDB without failing the spin", async () => {
    const { client } = fakeClient({
      details: (id) => {
        if (id % 3 === 0) {
          throw new AppError("TMDB_NOT_FOUND", 404, "That movie could not be found.");
        }
        return movieDetails(id);
      },
    });

    const result = await findRandomMovieWithClient(client, defaultFilters(), [], {
      rng: () => 0.2,
    });
    expect(result.movie.id % 3).not.toBe(0);
  });

  it("samples pages beyond the first page for a single set of filters", async () => {
    const { client, get } = fakeClient();
    await findRandomMovieWithClient(client, defaultFilters(), [], { rng: () => 0.5 });

    const pages = get.mock.calls
      .filter(([path]) => path === "/discover/movie")
      .map(([, params]) => Number(params?.page));
    expect(pages.length).toBeGreaterThan(1);
    expect(new Set(pages).size).toBe(pages.length);
  });
});
