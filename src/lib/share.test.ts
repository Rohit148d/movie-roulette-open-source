// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { shareMovie, sharePayload } from "@/lib/share";
import type { Movie } from "@/lib/tmdb/types";

function movie(overrides: Partial<Movie> = {}): Movie {
  return {
    id: 603,
    title: "The Matrix",
    originalTitle: "The Matrix",
    overview: "A hacker learns the truth.",
    tagline: null,
    releaseDate: "1999-03-31",
    releaseYear: 1999,
    runtime: 136,
    voteAverage: 8.2,
    voteCount: 25_000,
    genres: [{ id: 878, name: "Science Fiction" }],
    language: "en",
    director: "Lana Wachowski",
    posterUrl: null,
    backdropUrl: null,
    tmdbUrl: "https://www.themoviedb.org/movie/603",
    trailer: null,
    ...overrides,
  };
}

afterEach(() => {
  delete (window as { MovieRouletteNative?: unknown }).MovieRouletteNative;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("sharePayload", () => {
  it("shares the title, release year and TMDB link", () => {
    const payload = sharePayload(movie());
    expect(payload.title).toBe("The Matrix (1999)");
    expect(payload.text).toBe("The Matrix (1999) — https://www.themoviedb.org/movie/603");
    expect(payload.url).toBe("https://www.themoviedb.org/movie/603");
  });

  it("omits the year when TMDB has no release date", () => {
    const payload = sharePayload(movie({ releaseYear: null, releaseDate: null }));
    expect(payload.title).toBe("The Matrix");
    expect(payload.text).not.toContain("()");
  });

  it("never includes private application state", () => {
    const payload = sharePayload(movie());
    expect(JSON.stringify(payload)).not.toMatch(/watchlist|filters|token|secret/i);
  });
});

describe("shareMovie", () => {
  it("uses the native Android bridge when the shell provides one", async () => {
    const share = vi.fn();
    (window as { MovieRouletteNative?: unknown }).MovieRouletteNative = { share };

    await expect(shareMovie(movie())).resolves.toBe("native");
    // The native shell adds the year itself, so the title must arrive bare.
    expect(share).toHaveBeenCalledWith(
      "The Matrix",
      "1999",
      "https://www.themoviedb.org/movie/603",
    );
  });

  it("falls back to the Web Share API in a browser", async () => {
    const share = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share });

    await expect(shareMovie(movie())).resolves.toBe("system");
    expect(share).toHaveBeenCalledWith(
      expect.objectContaining({ title: "The Matrix (1999)" }),
    );
  });

  it("reports a cancelled system share without throwing", async () => {
    const share = vi.fn().mockRejectedValue(
      Object.assign(new Error("cancelled"), { name: "AbortError" }),
    );
    vi.stubGlobal("navigator", { ...navigator, share });

    await expect(shareMovie(movie())).resolves.toBe("cancelled");
  });

  it("copies the link when no share surface exists", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal("navigator", { ...navigator, share: undefined, clipboard: { writeText } });

    await expect(shareMovie(movie())).resolves.toBe("copied");
    expect(writeText).toHaveBeenCalledWith(
      "The Matrix (1999) — https://www.themoviedb.org/movie/603",
    );
  });

  it("reports unavailability instead of crashing when everything fails", async () => {
    vi.stubGlobal("navigator", {
      ...navigator,
      share: undefined,
      clipboard: {
        writeText: vi.fn().mockRejectedValue(new Error("denied")),
      },
    });

    await expect(shareMovie(movie())).resolves.toBe("unavailable");
  });
});
