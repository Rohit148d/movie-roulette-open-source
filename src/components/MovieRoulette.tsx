"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FilterPanel } from "@/components/FilterPanel";
import { HistoryStrip } from "@/components/HistoryStrip";
import { MovieResult } from "@/components/MovieResult";
import { RouletteWheel } from "@/components/RouletteWheel";
import { WatchlistDrawer } from "@/components/WatchlistDrawer";
import {
  ArrowIcon,
  FilmIcon,
  FilterIcon,
  ReelIcon,
  SparkIcon,
  TicketIcon,
} from "@/components/icons";
import {
  defaultFilters,
  filtersToSearchParams,
  type Filters,
} from "@/lib/filters";
import {
  clearSessionStorage,
  loadFilters,
  loadSession,
  loadWatchlist,
  MAX_HISTORY_ITEMS,
  MAX_SEEN_IDS,
  MAX_WATCHLIST_ITEMS,
  saveFilters,
  saveSession,
  saveWatchlist,
} from "@/lib/storage";
import { shareMovie } from "@/lib/share";
import type { DiscoverPool, Movie, RandomMovieResult } from "@/lib/tmdb/types";
import { formatVotes, reelNumber } from "@/lib/format";

type TmdbStatus = "unknown" | "live" | "demo" | "unconfigured" | "misconfigured";

interface ApiErrorBody {
  error?: {
    code?: string;
    message?: string;
    retryAfterSeconds?: number;
    details?: { fields?: Record<string, string[]> };
  };
}

interface ViewError {
  code: string;
  message: string;
  retryAfterSeconds?: number;
  fields?: Record<string, string[]>;
}

interface RandomSuccess extends RandomMovieResult {
  requestId?: string;
}

const STATUS_LABEL: Record<TmdbStatus, string> = {
  unknown: "Connecting",
  live: "TMDB live",
  demo: "Demo mode",
  unconfigured: "Setup needed",
  misconfigured: "TMDB error",
};

function isMovie(value: unknown): value is Movie {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as Movie).id === "number" &&
    typeof (value as Movie).title === "string"
  );
}

export function MovieRoulette() {
  const [hydrated, setHydrated] = useState(false);
  const [filters, setFilters] = useState<Filters>(() => defaultFilters());
  const [watchlist, setWatchlist] = useState<Movie[]>([]);
  const [history, setHistory] = useState<Movie[]>([]);
  const [seenIds, setSeenIds] = useState<number[]>([]);
  const [current, setCurrent] = useState<Movie | null>(null);
  const [source, setSource] = useState<"live" | "demo">("live");
  const [pool, setPool] = useState<DiscoverPool | null>(null);
  const [isSpinning, setIsSpinning] = useState(false);
  const [tmdbStatus, setTmdbStatus] = useState<TmdbStatus>("unknown");
  const [error, setError] = useState<ViewError | null>(null);
  const [exhausted, setExhausted] = useState(false);
  const [watchlistOpen, setWatchlistOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [notice, setNotice] = useState<string | null>(null);

  const spinLockRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const storageWarnedRef = useRef(false);

  const revealStage = useCallback(() => {
    if (typeof window === "undefined") return;
    const element = resultRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (rect.top <= window.innerHeight * 0.55) return;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const headerOffset = 92;
    window.scrollTo({
      top: Math.max(0, rect.top + window.scrollY - headerOffset),
      behavior: reduceMotion ? "auto" : "smooth",
    });
  }, []);

  const showNotice = useCallback((message: string) => {
    setNotice(message);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setNotice(null), 3_200);
  }, []);

  // Hydrate persisted state only after mount to avoid server/client mismatch.
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      const storedFilters = loadFilters();
      if (storedFilters) setFilters(storedFilters);
      setWatchlist(loadWatchlist());
      const session = loadSession();
      setSeenIds(session.seen);
      setHistory(session.history);
      if (session.history[0]) setCurrent(session.history[0]);
      setHydrated(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveFilters(filters) && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      showNotice("Filters couldn't be saved in this browser.");
    }
  }, [filters, hydrated, showNotice]);

  useEffect(() => {
    if (!hydrated) return;
    if (!saveWatchlist(watchlist) && !storageWarnedRef.current) {
      storageWarnedRef.current = true;
      showNotice("Watchlist storage is unavailable in this browser.");
    }
  }, [watchlist, hydrated, showNotice]);

  useEffect(() => {
    if (!hydrated) return;
    saveSession(seenIds, history);
  }, [seenIds, history, hydrated]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const checkHealth = useCallback(async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    try {
      const response = await fetch("/api/health", {
        signal: controller.signal,
        cache: "no-store",
        headers: { Accept: "application/json" },
      });
      const body = (await response.json()) as { tmdb?: TmdbStatus };
      if (body.tmdb) setTmdbStatus(body.tmdb);
    } catch {
      setTmdbStatus("unknown");
    } finally {
      clearTimeout(timer);
    }
  }, []);

  useEffect(() => {
    const id = setTimeout(() => void checkHealth(), 0);
    return () => clearTimeout(id);
  }, [checkHealth]);

  const spin = useCallback(
    async (options: { excludeIds?: number[] } = {}) => {
      if (spinLockRef.current) return;
      spinLockRef.current = true;
      setIsSpinning(true);
      setError(null);
      setExhausted(false);
      setFiltersOpen(false);
      setAnnouncement("Spinning the reel…");

      const controller = new AbortController();
      abortRef.current = controller;
      const timer = setTimeout(
        () => controller.abort(new DOMException("Spin timed out", "TimeoutError")),
        25_000,
      );
      const excludeIds = (options.excludeIds ?? seenIds).slice(-MAX_SEEN_IDS);

      try {
        const params = filtersToSearchParams(filters, excludeIds);
        const response = await fetch(`/api/movies/random?${params.toString()}`, {
          signal: controller.signal,
          cache: "no-store",
          headers: { Accept: "application/json" },
        });
        const body = (await response.json().catch(() => null)) as
          | RandomSuccess
          | ApiErrorBody
          | null;

        if (!response.ok) {
          const apiError = (body as ApiErrorBody | null)?.error;
          const code = apiError?.code ?? "UNKNOWN";
          const message =
            apiError?.message ??
            "The projector jammed. Please try spinning again in a moment.";
          setError({
            code,
            message,
            retryAfterSeconds: apiError?.retryAfterSeconds,
            fields: apiError?.details?.fields,
          });
          if (code === "POOL_EXHAUSTED") setExhausted(true);
          if (code === "TMDB_NOT_CONFIGURED") setTmdbStatus("unconfigured");
          if (code === "TMDB_INVALID_CREDENTIALS") setTmdbStatus("misconfigured");
          setAnnouncement(message);
          setTimeout(revealStage, 120);
          return;
        }

        const data = body as RandomSuccess | null;
        if (!data || !isMovie(data.movie) || !data.pool) {
          throw new Error("Malformed API response");
        }

        setCurrent(data.movie);
        setSource(data.source === "demo" ? "demo" : "live");
        setPool(data.pool);
        setSeenIds((previous) => {
          const next = [...previous.filter((id) => id !== data.movie.id), data.movie.id];
          return next.slice(-MAX_SEEN_IDS);
        });
        setHistory((previous) =>
          [data.movie, ...previous.filter((movie) => movie.id !== data.movie.id)].slice(
            0,
            MAX_HISTORY_ITEMS,
          ),
        );
        setAnnouncement(
          `Now showing ${data.movie.title}${
            data.movie.releaseYear ? `, ${data.movie.releaseYear}` : ""
          }.`,
        );

        setTimeout(revealStage, 120);
      } catch {
        const timedOut =
          controller.signal.aborted &&
          controller.signal.reason instanceof DOMException &&
          controller.signal.reason.name === "TimeoutError";
        const aborted = controller.signal.aborted && !timedOut;
        const message = timedOut
          ? "The reel took too long to turn. TMDB may be slow — try another spin."
          : aborted
            ? "The spin was cancelled."
            : "We couldn't reach the projector. Check your connection and try again.";
        setError({ code: timedOut ? "CLIENT_TIMEOUT" : "NETWORK", message });
        setAnnouncement(message);
      } finally {
        clearTimeout(timer);
        spinLockRef.current = false;
        abortRef.current = null;
        setIsSpinning(false);
      }
    },
    [filters, seenIds, revealStage],
  );

  const changeFilters = useCallback((next: Filters) => {
    setFilters(next);
    setError(null);
    setExhausted(false);
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters());
    setError(null);
    setExhausted(false);
    showNotice("Filters reset to the house defaults.");
  }, [showNotice]);

  const startNewSession = useCallback(async () => {
    setSeenIds([]);
    setHistory([]);
    setCurrent(null);
    setPool(null);
    setExhausted(false);
    setError(null);
    clearSessionStorage();
    await spin({ excludeIds: [] });
  }, [spin]);

  const openFilters = useCallback(() => {
    setFiltersOpen(true);
    setTimeout(() => {
      document.getElementById("filters")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      });
    }, 30);
  }, []);

  const toggleWatchlist = useCallback(
    (movie: Movie) => {
      const exists = watchlist.some((item) => item.id === movie.id);
      if (exists) {
        setWatchlist((previous) => previous.filter((item) => item.id !== movie.id));
        showNotice(`Removed “${movie.title}” from your watchlist.`);
        return;
      }
      if (watchlist.length >= MAX_WATCHLIST_ITEMS) {
        showNotice("Your watchlist is full. Remove a film before adding another.");
        return;
      }
      setWatchlist((previous) => [movie, ...previous].slice(0, MAX_WATCHLIST_ITEMS));
      showNotice(`Saved “${movie.title}” to your watchlist.`);
    },
    [watchlist, showNotice],
  );

  const removeFromWatchlist = useCallback(
    (id: number) => {
      const movie = watchlist.find((item) => item.id === id);
      setWatchlist((previous) => previous.filter((item) => item.id !== id));
      if (movie) showNotice(`Removed “${movie.title}” from your watchlist.`);
    },
    [watchlist, showNotice],
  );

  const clearWatchlist = useCallback(() => {
    setWatchlist([]);
    showNotice("Watchlist cleared.");
  }, [showNotice]);

  const shareCurrent = useCallback(
    async (movie: Movie) => {
      const outcome = await shareMovie(movie);
      if (outcome === "copied") {
        showNotice(`Link for “${movie.title}” copied to the clipboard.`);
      } else if (outcome === "unavailable") {
        showNotice(`Couldn't open the share menu. ${movie.tmdbUrl}`);
      }
    },
    [showNotice],
  );

  const showSavedMovie = useCallback((movie: Movie) => {
    setCurrent(movie);
    setWatchlistOpen(false);
    setError(null);
    setExhausted(false);
    setAnnouncement(`Showing ${movie.title}.`);
  }, []);

  // Keyboard shortcut: S spins when focus is not inside a control or dialog.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key.toLowerCase() !== "s") return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [role='dialog']",
        )
      ) {
        return;
      }
      if (watchlistOpen || filtersOpen) return;
      event.preventDefault();
      void spin();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [spin, watchlistOpen, filtersOpen]);

  const activeSeen = seenIds.length;
  const poolLabel = pool
    ? `${pool.totalResults.toLocaleString("en-US")} films in tonight's pool`
    : isSpinning
      ? "Threading the projector"
      : "The archive is waiting";
  const setupNeeded = tmdbStatus === "unconfigured" || tmdbStatus === "misconfigured";
  const currentReel = reelNumber(history.length || 1);

  return (
    <>
      <a className="skip-link" href="#main">
        Skip to the reel
      </a>
      <div className="ambient" aria-hidden="true">
        <div className="ambient-glow ambient-glow-gold" />
        <div className="ambient-glow ambient-glow-red" />
        <div className="ambient-vignette" />
      </div>
      <div className="film-grain" aria-hidden="true" />

      <header className="site-header">
        <a className="brand" href="#top" aria-label="Movie Roulette — back to top">
          <span className="brand-mark">
            <ReelIcon />
          </span>
          <span className="brand-wordmark">
            Movie
            <em>Roulette</em>
          </span>
        </a>
        <div className="header-actions">
          <span className={`status-pill status-${tmdbStatus}`}>
            <span className="status-dot" aria-hidden="true" />
            {STATUS_LABEL[tmdbStatus]}
          </span>
          <button
            type="button"
            className="watchlist-button"
            onClick={() => setWatchlistOpen(true)}
            aria-haspopup="dialog"
            aria-label={`Open watchlist, ${watchlist.length} saved`}
          >
            <TicketIcon className="inline-icon" />
            <span>Watchlist</span>
            <span className="watchlist-badge">{watchlist.length}</span>
          </button>
        </div>
      </header>

      <main id="main" className="site-main">
        <section className="hero" id="top" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">
              <span className="eyebrow-line" aria-hidden="true" />
              A cinematic decision engine
            </p>
            <h1 id="hero-title" className="hero-title">
              Stop scrolling.
              <br />
              <span>Start watching.</span>
            </h1>
            <p className="hero-lede">
              Set the mood, spin the reel, and let fate program your next movie night.
              Every spin is a fresh cut — no repeats in this session.
            </p>
            <div className="hero-actions">
              <button
                type="button"
                className="button button-gold button-spin"
                onClick={() => void spin()}
                disabled={isSpinning || setupNeeded}
                aria-keyshortcuts="S"
              >
                <ReelIcon className="button-icon button-icon-reel" />
                {isSpinning ? "Spinning the reel…" : "Spin the reel"}
                <kbd className="key-hint">S</kbd>
              </button>
              <button type="button" className="button button-outline mobile-filter-button" onClick={openFilters}>
                <FilterIcon className="button-icon" />
                Filters
              </button>
            </div>
            <dl className="hero-stats">
              <div>
                <dt>Session</dt>
                <dd>{activeSeen} seen</dd>
              </div>
              <div>
                <dt>Watchlist</dt>
                <dd>{watchlist.length} saved</dd>
              </div>
              <div>
                <dt>House rules</dt>
                <dd>No repeats</dd>
              </div>
            </dl>
          </div>

          <div className="hero-reel">
            <RouletteWheel
              spinning={isSpinning}
              posterUrl={current?.posterUrl ?? null}
              title={current?.title ?? null}
            />
            <div className="hero-reel-caption">
              <span className="caption-rule" aria-hidden="true" />
              <span>{isSpinning ? "Fate is flickering…" : poolLabel}</span>
              <span className="caption-rule" aria-hidden="true" />
            </div>
            <p className="hero-reel-note">EST. MMXXVI · CELLULOID FORTUNE</p>
          </div>
        </section>

        {tmdbStatus === "demo" ? (
          <div className="mode-banner mode-banner-demo" role="note">
            <SparkIcon className="inline-icon" />
            <span>
              <strong>Demo mode.</strong> These are local sample films, not live TMDB
              data. Set <code>TMDB_READ_ACCESS_TOKEN</code> to spin the real archive.
            </span>
          </div>
        ) : null}

        <div className="workspace">
          <aside
            className={`filters-sidebar ${filtersOpen ? "is-open" : ""}`}
            id="filters"
            aria-label="Filters"
          >
            <FilterPanel
              filters={filters}
              onChange={changeFilters}
              onReset={resetFilters}
              onSpin={() => void spin()}
              onClose={filtersOpen ? () => setFiltersOpen(false) : undefined}
              spinning={isSpinning}
            />
          </aside>
          {filtersOpen ? (
            <button
              type="button"
              className="filters-scrim"
              aria-label="Close filters"
              onClick={() => setFiltersOpen(false)}
            />
          ) : null}

          <section className="stage" aria-label="Tonight's movie">
            <p className="sr-only" role="status" aria-live="polite">
              {announcement}
            </p>

            <div ref={resultRef} className="stage-anchor" />

            {setupNeeded && !isSpinning ? (
              <div className="state-card setup-card">
                <span className="state-icon">
                  <ReelIcon />
                </span>
                <p className="eyebrow eyebrow-small">Projector offline</p>
                <h2>
                  {tmdbStatus === "misconfigured"
                    ? "The TMDB credentials were rejected."
                    : "Connect the projector."}
                </h2>
                <p>
                  {tmdbStatus === "misconfigured"
                    ? "Check that the server's TMDB read access token is valid, then restart the app."
                    : "This deployment still needs a TMDB API token on the server. Add it as an environment secret — never to the browser."}
                </p>
                <div className="setup-code">
                  <code>TMDB_READ_ACCESS_TOKEN=your_v4_token</code>
                </div>
                <div className="state-actions">
                  <button type="button" className="button button-gold" onClick={() => void checkHealth()}>
                    Check connection
                  </button>
                  <button type="button" className="button button-ghost" onClick={openFilters}>
                    Set filters meanwhile
                  </button>
                </div>
                <p className="state-footnote">
                  You are seeing this because no live TMDB session is available on the
                  server.
                </p>
              </div>
            ) : isSpinning ? (
              <div className="loading-state" aria-busy="true" aria-label="Finding a movie">
                <div className="loading-poster">
                  <span className="shimmer" />
                  <ReelIcon className="loading-reel-icon" />
                </div>
                <div className="loading-copy">
                  <p className="eyebrow eyebrow-small">Rolling the dice</p>
                  <h2>Finding tonight&apos;s film…</h2>
                  <div className="loading-lines" aria-hidden="true">
                    <span className="shimmer" />
                    <span className="shimmer" />
                    <span className="shimmer" />
                  </div>
                  <div className="loading-steps" role="status">
                    <span>Shuffling the archive</span>
                    <span>Checking runtime &amp; rating</span>
                    <span>Threading the projector</span>
                  </div>
                </div>
              </div>
            ) : exhausted && error ? (
              <div className="state-card exhausted-card">
                <span className="state-icon">
                  <FilmIcon />
                </span>
                <p className="eyebrow eyebrow-small">Reel exhausted</p>
                <h2>Every frame has been shown.</h2>
                <p>{error.message}</p>
                <div className="state-actions">
                  <button type="button" className="button button-gold" onClick={() => void startNewSession()}>
                    Start a new session
                  </button>
                  <button type="button" className="button button-outline" onClick={openFilters}>
                    Widen filters
                  </button>
                </div>
                <p className="state-footnote">
                  {seenIds.length} films seen this session. Your watchlist is still safe.
                </p>
              </div>
            ) : error ? (
              <div className="state-card error-card" role="alert">
                <span className="state-icon">
                  <ReelIcon />
                </span>
                <p className="eyebrow eyebrow-small">Intermission</p>
                <h2>The reel hit a snag.</h2>
                <p>{error.message}</p>
                {error.retryAfterSeconds ? (
                  <p className="state-footnote">
                    Try again in about {error.retryAfterSeconds} seconds.
                  </p>
                ) : null}
                {error.fields ? (
                  <ul className="field-errors">
                    {Object.entries(error.fields).flatMap(([field, messages]) =>
                      messages.map((message) => <li key={`${field}-${message}`}>{message}</li>),
                    )}
                  </ul>
                ) : null}
                <div className="state-actions">
                  <button type="button" className="button button-gold" onClick={() => void spin()}>
                    Spin again <ArrowIcon className="button-icon" />
                  </button>
                  <button type="button" className="button button-ghost" onClick={openFilters}>
                    Adjust filters
                  </button>
                </div>
              </div>
            ) : current ? (
              <div className="result-wrap" key={current.id}>
                <MovieResult
                  movie={current}
                  reel={currentReel}
                  source={source}
                  isWatchlisted={watchlist.some((item) => item.id === current.id)}
                  onSpin={() => void spin()}
                  onToggleWatchlist={toggleWatchlist}
                  onShare={(movie) => void shareCurrent(movie)}
                />
              </div>
            ) : (
              <div className="state-card empty-card">
                <span className="state-icon">
                  <ReelIcon />
                </span>
                <p className="eyebrow eyebrow-small">The house is dark</p>
                <h2>The reel is waiting.</h2>
                <p>
                  Pick a few genres, set a runtime, and let the projector choose. Your
                  filters are already tuned to a crowd-pleasing middle ground.
                </p>
                <div className="state-actions">
                  <button type="button" className="button button-gold" onClick={() => void spin()}>
                    <SparkIcon className="button-icon" /> Spin the reel
                  </button>
                  <button type="button" className="button button-ghost" onClick={openFilters}>
                    Tune the mood
                  </button>
                </div>
                <p className="state-footnote">
                  Tip: press <kbd>S</kbd> anywhere to spin. Rating data by TMDB.
                </p>
              </div>
            )}

            <HistoryStrip
              history={history}
              currentId={current?.id ?? null}
              onSelect={showSavedMovie}
            />

            <div className="stage-meta">
              <span>
                {pool
                  ? `${formatVotes(pool.totalResults).replace(" votes", "")} results · ${pool.scannedPages} pages sampled`
                  : "Randomised across the whole archive"}
              </span>
              <span aria-hidden="true">·</span>
              <span>{activeSeen} films seen this session</span>
            </div>
          </section>
        </div>
      </main>

      <footer className="site-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <ReelIcon className="inline-icon" />
            <span>Movie Roulette</span>
          </div>
          <div className="footer-attribution">
            <a
              className="tmdb-mark"
              href="https://www.themoviedb.org/"
              target="_blank"
              rel="noopener noreferrer"
            >
              <img
                src="https://www.themoviedb.org/assets/v4/logos/v2/blue_short-8e7b30f73a4020692ccca9c88bafe5dcb6f8a62a4c6bc55cd9ba82bb2cd95f6c.svg"
                alt="TMDB"
                width={90}
                height={32}
                loading="lazy"
              />
            </a>
            <p>
              This product uses the TMDB API but is not endorsed or certified by TMDB.
              Movie data and images are supplied by TMDB.
            </p>
          </div>
          <div className="footer-notes">
            <span>Watchlist &amp; filters stay in your browser.</span>
            <span>Press <kbd>S</kbd> to spin · <kbd>Esc</kbd> to close panels</span>
          </div>
        </div>
      </footer>

      <WatchlistDrawer
        open={watchlistOpen}
        items={watchlist}
        onClose={() => setWatchlistOpen(false)}
        onRemove={removeFromWatchlist}
        onSelect={showSavedMovie}
        onClear={clearWatchlist}
      />

      {notice ? (
        <div className="toast" role="status" aria-live="polite">
          {notice}
        </div>
      ) : null}
    </>
  );
}
