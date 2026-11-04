// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { defaultFilters } from "@/lib/filters";
import {
  clearSessionStorage,
  loadFilters,
  loadSession,
  loadWatchlist,
  MAX_SEEN_IDS,
  saveFilters,
  saveSession,
  saveWatchlist,
} from "@/lib/storage";
import type { Movie } from "@/lib/tmdb/types";

function movie(id: number, title: string): Movie {
  return {
    id,
    title,
    originalTitle: title,
    overview: "",
    tagline: null,
    releaseDate: "2020-01-01",
    releaseYear: 2020,
    runtime: 100,
    voteAverage: 7.5,
    voteCount: 100,
    genres: [{ id: 28, name: "Action" }],
    language: "en",
    director: null,
    posterUrl: null,
    backdropUrl: null,
    tmdbUrl: "https://www.themoviedb.org/movie/1",
  };
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("filter persistence", () => {
  it("saves and reloads valid filters", () => {
    const filters = { ...defaultFilters(), genres: [28], minRating: 8 };
    expect(saveFilters(filters)).toBe(true);
    expect(loadFilters()).toEqual(filters);
  });

  it("ignores corrupted filter payloads", () => {
    window.localStorage.setItem("movie-roulette:filters:v1", "{not json");
    expect(loadFilters()).toBeNull();
    window.localStorage.setItem(
      "movie-roulette:filters:v1",
      JSON.stringify({ ...defaultFilters(), minRating: 99 }),
    );
    expect(loadFilters()).toBeNull();
  });
});

describe("watchlist persistence", () => {
  it("round-trips movies and filters malformed entries", () => {
    saveWatchlist([movie(1, "One"), { bad: true } as unknown as Movie]);
    const loaded = loadWatchlist();
    expect(loaded).toHaveLength(1);
    expect(loaded[0].title).toBe("One");
  });

  it("caps the watchlist size", () => {
    const items = Array.from({ length: 130 }, (_, index) => movie(index + 1, `Movie ${index}`));
    saveWatchlist(items);
    expect(loadWatchlist()).toHaveLength(100);
  });
});

describe("session persistence", () => {
  it("stores seen ids and history and clears them", () => {
    saveSession([1, 2, 3], [movie(3, "Three")]);
    const session = loadSession();
    expect(session.seen).toEqual([1, 2, 3]);
    expect(session.history[0].title).toBe("Three");

    clearSessionStorage();
    expect(loadSession()).toEqual({ seen: [], history: [] });
  });

  it("caps stored seen ids to the API exclusion limit", () => {
    const ids = Array.from({ length: 250 }, (_, index) => index + 1);
    saveSession(ids, []);
    const session = loadSession();
    expect(session.seen).toHaveLength(MAX_SEEN_IDS);
    expect(session.seen.at(-1)).toBe(250);
  });
});
