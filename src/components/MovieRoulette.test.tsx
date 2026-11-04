// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MovieRoulette } from "@/components/MovieRoulette";
import type { Movie } from "@/lib/tmdb/types";

function movie(id: number, title: string): Movie {
  return {
    id,
    title,
    originalTitle: title,
    overview: "A test movie overview.",
    tagline: "A test tagline",
    releaseDate: "2015-05-05",
    releaseYear: 2015,
    runtime: 112,
    voteAverage: 7.8,
    voteCount: 4_321,
    genres: [{ id: 28, name: "Action" }],
    language: "en",
    director: "Test Director",
    posterUrl: null,
    backdropUrl: null,
    tmdbUrl: `https://www.themoviedb.org/movie/${id}`,
    trailer:
      id === 101
        ? {
            key: "abc123XYZ",
            name: "Official trailer",
            site: "YouTube" as const,
            url: "https://www.youtube.com/watch?v=abc123XYZ",
          }
        : null,
  };
}

const MOVIES = [movie(101, "First Feature"), movie(202, "Second Feature")];

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface MockState {
  randomCalls: string[];
  nextMovieIndex: number;
  randomError?: { status: number; body: unknown };
}

function installFetchMock(): MockState {
  const state: MockState = { randomCalls: [], nextMovieIndex: 0 };

  vi.stubGlobal(
    "fetch",
    vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/health")) {
        return json({ status: "ok", service: "movie-roulette", tmdb: "live" });
      }
      if (url.includes("/api/movies/random")) {
        state.randomCalls.push(url);
        if (state.randomError) {
          return json(state.randomError.body, state.randomError.status);
        }
        const selected = MOVIES[state.nextMovieIndex % MOVIES.length];
        state.nextMovieIndex += 1;
        return json({
          movie: selected,
          pool: { totalResults: 120, totalPages: 6, eligiblePages: 6, scannedPages: 2 },
          attempts: 1,
          source: "live",
          requestId: "test-request",
        });
      }
      return json({}, 404);
    }),
  );

  return state;
}

beforeEach(() => {
  window.localStorage.clear();
  window.sessionStorage.clear();
});

describe("MovieRoulette", () => {
  it("renders the cinematic shell and spins into a verified result", async () => {
    installFetchMock();
    const user = userEvent.setup();
    render(<MovieRoulette />);

    expect(await screen.findByText("The reel is waiting.")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("TMDB live")).toBeInTheDocument());

    const spinButton = screen.getAllByRole("button", { name: /spin the reel/i })[0];
    await user.click(spinButton);

    const result = await screen.findByRole("article");
    expect(within(result).getByRole("heading", { name: "First Feature" })).toBeInTheDocument();
    expect(within(result).getByText("1h 52m")).toBeInTheDocument();
    expect(within(result).getByText("Test Director", { exact: false })).toBeInTheDocument();
    expect(result).toHaveAttribute("data-movie-id", "101");
    expect(result).toHaveAttribute("data-genres", "28");
  });

  it("excludes previously seen movies in later spins", async () => {
    const state = installFetchMock();
    const user = userEvent.setup();
    render(<MovieRoulette />);

    const spinButton = screen.getAllByRole("button", { name: /spin the reel/i })[0];
    await user.click(spinButton);
    await screen.findByRole("heading", { name: "First Feature" });

    await user.click(screen.getByRole("button", { name: /spin again/i }));
    await screen.findByRole("heading", { name: "Second Feature" });

    expect(state.randomCalls).toHaveLength(2);
    expect(state.randomCalls[1]).toContain("exclude=101");
  });

  it("opens the TMDB trailer and shares the movie through the Android bridge", async () => {
    installFetchMock();
    const nativeShare = vi.fn();
    (window as unknown as { MovieRouletteNative?: unknown }).MovieRouletteNative = {
      share: nativeShare,
    };
    const user = userEvent.setup();
    render(<MovieRoulette />);

    try {
      await user.click(screen.getAllByRole("button", { name: /spin the reel/i })[0]);
      await screen.findByRole("heading", { name: "First Feature" });

      const trailer = screen.getByTestId("trailer-link");
      expect(trailer).toHaveAttribute("href", "https://www.youtube.com/watch?v=abc123XYZ");
      expect(trailer).toHaveAttribute("target", "_blank");
      expect(trailer).toHaveAttribute("rel", "noopener noreferrer");

      await user.click(screen.getByRole("button", { name: /share first feature/i }));
      expect(nativeShare).toHaveBeenCalledWith(
        "First Feature",
        "2015",
        "https://www.themoviedb.org/movie/101",
      );

      // A movie without TMDB trailer metadata must not show a trailer control.
      await user.click(screen.getByRole("button", { name: /spin again/i }));
      await screen.findByRole("heading", { name: "Second Feature" });
      expect(screen.queryByTestId("trailer-link")).toBeNull();
    } finally {
      delete (window as unknown as { MovieRouletteNative?: unknown }).MovieRouletteNative;
    }
  });

  it("saves movies to a persistent watchlist", async () => {
    installFetchMock();
    const user = userEvent.setup();
    const view = render(<MovieRoulette />);

    await user.click(screen.getAllByRole("button", { name: /spin the reel/i })[0]);
    await screen.findByRole("heading", { name: "First Feature" });
    await user.click(screen.getByRole("button", { name: /save to watchlist/i }));

    expect(screen.getByRole("button", { name: /saved to watchlist/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    const stored = JSON.parse(window.localStorage.getItem("movie-roulette:watchlist:v1") ?? "[]");
    expect(stored[0].title).toBe("First Feature");

    view.unmount();
    render(<MovieRoulette />);
    const watchlistButton = await screen.findByRole("button", {
      name: /open watchlist, 1 saved/i,
    });
    await user.click(watchlistButton);
    const dialog = document.querySelector("dialog");
    expect(dialog).not.toBeNull();
    expect(within(dialog as HTMLElement).getAllByText("First Feature").length).toBeGreaterThan(0);
  });

  it("persists filter changes across mounts", async () => {
    installFetchMock();
    const user = userEvent.setup();
    const view = render(<MovieRoulette />);

    const actionChip = await screen.findByRole("button", { name: "Action" });
    expect(actionChip).toHaveAttribute("aria-pressed", "false");
    await user.click(actionChip);
    expect(actionChip).toHaveAttribute("aria-pressed", "true");

    await waitFor(() => {
      const stored = JSON.parse(
        window.localStorage.getItem("movie-roulette:filters:v1") ?? "{}",
      );
      expect(stored.genres).toEqual([28]);
    });

    view.unmount();
    render(<MovieRoulette />);
    const restored = await screen.findByRole("button", { name: "Action" });
    expect(restored).toHaveAttribute("aria-pressed", "true");
  });

  it("shows a friendly setup state when TMDB is not configured", async () => {
    const state = installFetchMock();
    state.randomError = {
      status: 503,
      body: {
        error: {
          code: "TMDB_NOT_CONFIGURED",
          message:
            "TMDB is not configured on this server. Add TMDB_READ_ACCESS_TOKEN to the environment and restart.",
        },
      },
    };
    const user = userEvent.setup();
    render(<MovieRoulette />);

    await user.click(screen.getAllByRole("button", { name: /spin the reel/i })[0]);
    expect(await screen.findByText("Connect the projector.")).toBeInTheDocument();
    expect(screen.getAllByText(/TMDB_READ_ACCESS_TOKEN/).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /check connection/i })).toBeInTheDocument();
  });

  it("handles an exhausted candidate pool with recovery actions", async () => {
    const state = installFetchMock();
    state.randomError = {
      status: 404,
      body: {
        error: {
          code: "POOL_EXHAUSTED",
          message:
            "Every movie on the sampled pages is already in this session. Start a new session or widen your filters.",
          details: { reason: "all_seen" },
        },
      },
    };
    const user = userEvent.setup();
    render(<MovieRoulette />);

    await user.click(screen.getAllByRole("button", { name: /spin the reel/i })[0]);
    expect(await screen.findByText("Every frame has been shown.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /start a new session/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /widen filters/i })).toBeInTheDocument();
  });
});
