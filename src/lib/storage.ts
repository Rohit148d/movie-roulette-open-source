import { validateStoredFilters, type Filters } from "@/lib/filters";
import type { Movie } from "@/lib/tmdb/types";

const FILTERS_KEY = "movie-roulette:filters:v1";
const WATCHLIST_KEY = "movie-roulette:watchlist:v1";
const SESSION_SEEN_KEY = "movie-roulette:seen:v1";
const SESSION_HISTORY_KEY = "movie-roulette:history:v1";

export const MAX_WATCHLIST_ITEMS = 100;
export const MAX_SEEN_IDS = 100;
export const MAX_HISTORY_ITEMS = 12;

function storageAvailable(kind: "local" | "session"): Storage | null {
  if (typeof window === "undefined") return null;
  try {
    return kind === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readJson(storage: Storage | null, key: string): unknown {
  if (!storage) return null;
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeJson(storage: Storage | null, key: string, value: unknown): boolean {
  if (!storage) return false;
  try {
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function isMovie(value: unknown): value is Movie {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Partial<Movie>;
  return (
    typeof candidate.id === "number" &&
    typeof candidate.title === "string" &&
    Array.isArray(candidate.genres) &&
    typeof candidate.voteAverage === "number"
  );
}

export function loadFilters(): Filters | null {
  const stored = readJson(storageAvailable("local"), FILTERS_KEY);
  return validateStoredFilters(stored);
}

export function saveFilters(filters: Filters): boolean {
  return writeJson(storageAvailable("local"), FILTERS_KEY, filters);
}

export function loadWatchlist(): Movie[] {
  const stored = readJson(storageAvailable("local"), WATCHLIST_KEY);
  if (!Array.isArray(stored)) return [];
  return stored.filter(isMovie).slice(0, MAX_WATCHLIST_ITEMS);
}

export function saveWatchlist(items: Movie[]): boolean {
  return writeJson(storageAvailable("local"), WATCHLIST_KEY, items.slice(0, MAX_WATCHLIST_ITEMS));
}

export interface StoredSession {
  seen: number[];
  history: Movie[];
}

export function loadSession(): StoredSession {
  const seenRaw = readJson(storageAvailable("session"), SESSION_SEEN_KEY);
  const historyRaw = readJson(storageAvailable("session"), SESSION_HISTORY_KEY);
  const seen = Array.isArray(seenRaw)
    ? seenRaw.filter((id): id is number => typeof id === "number" && Number.isInteger(id)).slice(-MAX_SEEN_IDS)
    : [];
  const history = Array.isArray(historyRaw)
    ? historyRaw.filter(isMovie).slice(0, MAX_HISTORY_ITEMS)
    : [];
  return { seen, history };
}

export function saveSession(seen: number[], history: Movie[]): void {
  const storage = storageAvailable("session");
  writeJson(storage, SESSION_SEEN_KEY, seen.slice(-MAX_SEEN_IDS));
  writeJson(storage, SESSION_HISTORY_KEY, history.slice(0, MAX_HISTORY_ITEMS));
}

export function clearSessionStorage(): void {
  const storage = storageAvailable("session");
  try {
    storage?.removeItem(SESSION_SEEN_KEY);
    storage?.removeItem(SESSION_HISTORY_KEY);
  } catch {
    // Ignore storage failures (private mode, quota).
  }
}
