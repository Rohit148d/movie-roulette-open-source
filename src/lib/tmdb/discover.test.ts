import { beforeEach, describe, expect, it } from "vitest";
import { defaultFilters, type Filters } from "@/lib/filters";
import {
  buildDiscoverParams,
  isCandidateAllowed,
  pickRandomPage,
  pickTrailer,
  resetRandomnessForTests,
  shuffled,
  toMovie,
  verifyMovie,
} from "@/lib/tmdb/discover";
import type { TmdbMovieDetails } from "@/lib/tmdb/types";

const filters: Filters = {
  ...defaultFilters(),
  genres: [28, 53],
  language: "ja",
  yearFrom: 1980,
  yearTo: 2004,
  minRating: 7.2,
  minVotes: 800,
  runtimeMin: 95,
  runtimeMax: 140,
};

function details(overrides: Partial<TmdbMovieDetails> = {}): TmdbMovieDetails {
  return {
    id: 1,
    title: "Test Film",
    overview: "An overview.",
    tagline: "A tagline.",
    release_date: "1999-05-01",
    runtime: 120,
    vote_average: 7.9,
    vote_count: 4_000,
    genres: [
      { id: 28, name: "Action" },
      { id: 53, name: "Thriller" },
    ],
    original_language: "ja",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    credits: { crew: [{ job: "Director", name: "A Director" }] },
    ...overrides,
  };
}

beforeEach(() => {
  resetRandomnessForTests();
});

describe("buildDiscoverParams", () => {
  it("maps every filter to the TMDB discover contract, including runtime bounds", () => {
    const params = buildDiscoverParams(filters, 3);
    expect(params).toMatchObject({
      page: 3,
      include_adult: false,
      include_video: false,
      language: "en-US",
      with_genres: "28,53",
      with_original_language: "ja",
      "primary_release_date.gte": "1980-01-01",
      "primary_release_date.lte": "2004-12-31",
      "vote_average.gte": 7.2,
      "vote_count.gte": 800,
      "with_runtime.gte": 95,
      "with_runtime.lte": 140,
    });
  });

  it("omits runtime bounds when the user leaves them blank", () => {
    const params = buildDiscoverParams({ ...filters, runtimeMin: null, runtimeMax: null }, 1);
    expect(params["with_runtime.gte"]).toBeUndefined();
    expect(params["with_runtime.lte"]).toBeUndefined();
  });

  it("caps requested pages at TMDB's discover limit", () => {
    expect(buildDiscoverParams(filters, 9_999).page).toBe(500);
    expect(buildDiscoverParams(filters, 0).page).toBe(1);
  });
});

describe("pickRandomPage", () => {
  it("avoids the pages already sampled for the same filters", () => {
    const page = pickRandomPage(10, filters, () => 0, [1, 2, 3]);
    expect(page).toBe(4);
  });

  it("never returns page one for the first draw when page one was already used", () => {
    const page = pickRandomPage(500, filters, () => 0, [1]);
    expect(page).toBe(2);
  });

  it("remembers recent pages across calls", () => {
    const first = pickRandomPage(100, filters, () => 0, [1]);
    const second = pickRandomPage(100, filters, () => 0, [1]);
    expect(second).not.toBe(first);
  });

  it("never exceeds the 500-page cap even when TMDB reports more", () => {
    const page = pickRandomPage(10_000, filters, () => 0.9999, []);
    expect(page).toBe(500);
  });

  it("falls back gracefully when every eligible page was already used", () => {
    const page = pickRandomPage(2, filters, () => 0, [1, 2]);
    expect([1, 2]).toContain(page);
  });
});

describe("verifyMovie", () => {
  it("accepts a movie that satisfies every selected filter", () => {
    expect(verifyMovie(details(), filters)).toEqual({ valid: true, reasons: [] });
  });

  it.each([
    ["runtime too short", { runtime: 80 }, "runtime_min"],
    ["runtime too long", { runtime: 200 }, "runtime_max"],
    ["missing runtime while runtime filters are active", { runtime: null }, "runtime_unknown"],
    ["release year outside range", { release_date: "2015-01-01" }, "release_year"],
    ["rating below minimum", { vote_average: 6.1 }, "rating"],
    ["too few votes", { vote_count: 10 }, "vote_count"],
    ["wrong language", { original_language: "en" }, "language"],
    ["missing a selected genre", { genres: [{ id: 28, name: "Action" }] }, "genres"],
    ["adult title", { adult: true }, "adult"],
    ["missing release date", { release_date: undefined }, "release_year"],
  ])("rejects a movie with %s", (_label, overrides, reason) => {
    const outcome = verifyMovie(details(overrides), filters);
    expect(outcome.valid).toBe(false);
    expect(outcome.reasons).toContain(reason);
  });

  it("allows unknown runtime when no runtime filter is set", () => {
    const relaxed = { ...filters, runtimeMin: null, runtimeMax: null };
    expect(verifyMovie(details({ runtime: null }), relaxed).valid).toBe(true);
  });
});

describe("toMovie", () => {
  it("builds safe public URLs and director data", () => {
    const movie = toMovie(details());
    expect(movie.posterUrl).toBe("https://image.tmdb.org/t/p/w500/poster.jpg");
    expect(movie.backdropUrl).toBe("https://image.tmdb.org/t/p/w1280/backdrop.jpg");
    expect(movie.director).toBe("A Director");
    expect(movie.releaseYear).toBe(1999);
    expect(movie.tmdbUrl).toBe("https://www.themoviedb.org/movie/1");
    expect(movie.overview).toBe("An overview.");
  });

  it("handles missing optional fields without exposing nulls as text", () => {
    const movie = toMovie(
      details({ poster_path: null, backdrop_path: null, overview: "", tagline: "  " }),
    );
    expect(movie.posterUrl).toBeNull();
    expect(movie.backdropUrl).toBeNull();
    expect(movie.tagline).toBeNull();
    expect(movie.overview).toMatch(/No synopsis/);
  });
});

describe("candidate eligibility and shuffling", () => {
  it("drops excluded, adult and video candidates", () => {
    const base = {
      id: 5,
      title: "x",
      original_title: "x",
      overview: "",
      vote_average: 8,
      vote_count: 100,
      popularity: 1,
      genre_ids: [28],
      original_language: "en",
      poster_path: null,
      backdrop_path: null,
    };
    expect(isCandidateAllowed(base, new Set())).toBe(true);
    expect(isCandidateAllowed(base, new Set([5]))).toBe(false);
    expect(isCandidateAllowed({ ...base, adult: true }, new Set())).toBe(false);
    expect(isCandidateAllowed({ ...base, video: true }, new Set())).toBe(false);
  });

  it("shuffles deterministically for an injected RNG without dropping items", () => {
    const input = [1, 2, 3, 4, 5];
    const output = shuffled(input, () => 0.999);
    expect(output).not.toBe(input);
    expect([...output].sort()).toEqual([1, 2, 3, 4, 5]);
  });
});

describe("pickTrailer", () => {
  it("returns nothing when TMDB has no videos", () => {
    expect(pickTrailer(undefined)).toBeNull();
    expect(pickTrailer([])).toBeNull();
    expect(toMovie(details()).trailer).toBeNull();
  });

  it("prefers an official YouTube trailer over clips, teasers and other sites", () => {
    const trailer = pickTrailer([
      { key: "clip12345", site: "YouTube", type: "Clip", name: "Clip" },
      { key: "vimeo12345", site: "Vimeo", type: "Trailer", official: true },
      { key: "teaser1234", site: "YouTube", type: "Teaser", name: "Teaser" },
      { key: "official12", site: "YouTube", type: "Trailer", official: true, iso_639_1: "en" },
      { key: "unofficia1", site: "YouTube", type: "Trailer", official: false },
    ]);

    expect(trailer).toEqual({
      key: "official12",
      name: "Official trailer",
      site: "YouTube",
      url: "https://www.youtube.com/watch?v=official12",
    });
  });

  it("ignores unsafe keys and non-video entries instead of building a bad link", () => {
    expect(
      pickTrailer([
        { key: "javascript:alert(1)", site: "YouTube", type: "Trailer" },
        { key: "short", site: "YouTube", type: "Trailer" },
        { key: "abcdefg", site: "YouTube", type: "Behind the Scenes" },
      ]),
    ).toBeNull();
  });
});
