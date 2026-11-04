import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GET } from "@/app/api/movies/random/route";
import { clearTmdbCache } from "@/lib/tmdb/cache";
import { resetRandomnessForTests } from "@/lib/tmdb/discover";
import { resetRateLimiters, spinIpLimiter } from "@/lib/security/rate-limit";
import type { TmdbDiscoverResponse, TmdbDiscoverResult, TmdbMovieDetails } from "@/lib/tmdb/types";

const PER_PAGE = 20;

function candidate(page: number, index: number): TmdbDiscoverResult {
  return {
    id: page * 1_000 + index,
    title: `Candidate ${page}-${index}`,
    original_title: `Candidate ${page}-${index}`,
    overview: "Live TMDB candidate.",
    release_date: "2002-06-01",
    vote_average: 8.1,
    vote_count: 2_500,
    popularity: 40,
    genre_ids: [28],
    original_language: "en",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    adult: false,
    video: false,
  };
}

function detail(id: number): TmdbMovieDetails {
  return {
    id,
    title: `Live Movie ${id}`,
    overview: "A live TMDB movie.",
    tagline: "Live from the API",
    release_date: "2002-06-01",
    runtime: 105,
    vote_average: 7.9,
    vote_count: 3_000,
    genres: [{ id: 28, name: "Action" }],
    original_language: "en",
    poster_path: "/poster.jpg",
    backdrop_path: "/backdrop.jpg",
    credits: { crew: [{ job: "Director", name: "A Director" }] },
  };
}

function tmdbJson(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function mockTmdb(options: { totalResults?: number; status?: number } = {}) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void init;
    const url = new URL(String(input));
    if (options.status && options.status !== 200) {
      return tmdbJson({}, options.status);
    }
    if (url.pathname.endsWith("/discover/movie")) {
      const page = Number(url.searchParams.get("page") ?? 1);
      const response: TmdbDiscoverResponse = {
        page,
        total_pages: 4,
        total_results: options.totalResults ?? 120,
        results: Array.from({ length: PER_PAGE }, (_, index) => candidate(page, index)),
      };
      return tmdbJson(response);
    }
    const match = /\/movie\/(\d+)$/.exec(url.pathname);
    if (match) return tmdbJson(detail(Number(match[1])));
    return tmdbJson({}, 404);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function request(query = "", headers: Record<string, string> = {}) {
  return new Request(`http://localhost/api/movies/random${query ? `?${query}` : ""}`, {
    headers: { "cf-connecting-ip": "203.0.113.10", ...headers },
  });
}

beforeEach(() => {
  clearTmdbCache();
  resetRandomnessForTests();
  resetRateLimiters();
  vi.stubEnv("TMDB_DEMO_MODE", "");
  vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "test-read-token");
  vi.stubEnv("TMDB_API_KEY", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("GET /api/movies/random", () => {
  it("returns a verified movie with security and rate-limit headers", async () => {
    const fetchMock = mockTmdb();
    const response = await GET(request("minRating=7&minVotes=500&runtimeMin=90&runtimeMax=140"));
    const body = (await response.json()) as {
      movie: { title: string; runtime: number; voteAverage: number };
      pool: { totalResults: number };
      source: string;
    };

    expect(response.status).toBe(200);
    expect(body.source).toBe("live");
    expect(body.movie.title).toMatch(/^Live Movie /);
    expect(body.movie.runtime).toBe(105);
    expect(body.movie.voteAverage).toBeGreaterThanOrEqual(7);
    expect(body.pool.totalResults).toBe(120);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-ratelimit-limit")).toBe("20");

    const init = fetchMock.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe(
      "Bearer test-read-token",
    );
    expect(JSON.stringify(body)).not.toContain("test-read-token");
  });

  it("rejects invalid filters before calling TMDB", async () => {
    const fetchMock = mockTmdb();
    const response = await GET(request("genres=999999"));
    const body = (await response.json()) as {
      error: { code: string; details?: { fields?: Record<string, string[]> } };
    };

    expect(response.status).toBe(400);
    expect(body.error.code).toBe("INVALID_FILTERS");
    expect(body.error.details?.fields?.genres?.length).toBeGreaterThan(0);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects an oversized exclude list", async () => {
    const fetchMock = mockTmdb();
    const ids = Array.from({ length: 101 }, (_, index) => index + 1).join(",");
    const response = await GET(request(`exclude=${ids}`));
    expect(response.status).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects implausibly long URLs", async () => {
    const response = await GET(request(`minVotes=${"9".repeat(4_200)}`));
    expect(response.status).toBe(400);
  });

  it("rate limits a client that spins too fast", async () => {
    mockTmdb();
    for (let index = 0; index < 20; index += 1) {
      spinIpLimiter.consume("203.0.113.10");
    }
    const response = await GET(request());
    const body = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(429);
    expect(body.error.code).toBe("RATE_LIMITED");
    expect(response.headers.get("retry-after")).toBeTruthy();
  });

  it("returns a friendly configuration error when TMDB is not configured", async () => {
    vi.stubEnv("TMDB_READ_ACCESS_TOKEN", "");
    const fetchMock = mockTmdb();
    const response = await GET(request());
    const body = (await response.json()) as { error: { code: string; message: string } };

    expect(response.status).toBe(503);
    expect(body.error.code).toBe("TMDB_NOT_CONFIGURED");
    expect(body.error.message).toContain("TMDB_READ_ACCESS_TOKEN");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("maps TMDB credential failures to a safe 502", async () => {
    mockTmdb({ status: 401 });
    const response = await GET(request());
    const body = (await response.json()) as { error: { code: string } };
    expect(response.status).toBe(502);
    expect(body.error.code).toBe("TMDB_INVALID_CREDENTIALS");
  });

  it("returns a specific exhausted-pool signal when filters match nothing", async () => {
    mockTmdb({ totalResults: 0 });
    const response = await GET(request("minRating=9.5&minVotes=1000000&yearFrom=1960&yearTo=1961"));
    const body = (await response.json()) as {
      error: { code: string; details?: { reason?: string } };
    };
    expect(response.status).toBe(404);
    expect(body.error.code).toBe("POOL_EXHAUSTED");
    expect(body.error.details?.reason).toBe("no_results");
  });

  it("never returns a movie that violates runtime bounds", async () => {
    mockTmdb();
    const response = await GET(
      request("genres=28&language=en&yearFrom=2000&yearTo=2005&minRating=7.5&minVotes=500&runtimeMin=100&runtimeMax=110"),
    );
    const body = (await response.json()) as {
      movie: { runtime: number; voteAverage: number; voteCount: number; language: string; genres: { id: number }[] };
    };
    expect(response.status).toBe(200);
    expect(body.movie.runtime).toBeGreaterThanOrEqual(100);
    expect(body.movie.runtime).toBeLessThanOrEqual(110);
    expect(body.movie.voteAverage).toBeGreaterThanOrEqual(7.5);
    expect(body.movie.voteCount).toBeGreaterThanOrEqual(500);
    expect(body.movie.language).toBe("en");
    expect(body.movie.genres.some((genre) => genre.id === 28)).toBe(true);
  });
});
