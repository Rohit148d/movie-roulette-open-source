import type { Movie } from "@/lib/tmdb/types";

/**
 * Native sharing for a single movie.
 *
 * Three tiers, in order:
 *  1. The Android shell's `MovieRouletteNative` bridge (Android WebView does
 *     not implement the Web Share API, so the APK supplies the system chooser).
 *  2. The Web Share API, when the browser has it.
 *  3. Clipboard fallback, so the link is never lost.
 *
 * Only public movie data is shared: title, release year and the TMDB page.
 * No watchlist, session or credential ever leaves the device.
 */

export interface SharePayload {
  title: string;
  text: string;
  url: string;
}

export type ShareOutcome = "native" | "system" | "copied" | "cancelled" | "unavailable";

interface NativeShareBridge {
  share?: (title: string, year: string, url: string) => void;
}

declare global {
  interface Window {
    MovieRouletteNative?: NativeShareBridge;
  }
}

export function sharePayload(movie: Movie): SharePayload {
  const year = movie.releaseYear ? String(movie.releaseYear) : "";
  const displayTitle = year ? `${movie.title} (${year})` : movie.title;
  // The TMDB detail page is the canonical, shareable link for a movie.
  const url = movie.tmdbUrl || `https://www.themoviedb.org/movie/${movie.id}`;
  return { title: displayTitle, text: `${displayTitle} — ${url}`, url };
}

export async function shareMovie(movie: Movie): Promise<ShareOutcome> {
  const payload = sharePayload(movie);
  const year = movie.releaseYear ? String(movie.releaseYear) : "";

  const bridge = typeof window !== "undefined" ? window.MovieRouletteNative : undefined;
  if (typeof bridge?.share === "function") {
    try {
      // The bridge formats its own heading, so pass the bare title here —
      // otherwise the year would be appended twice.
      bridge.share(movie.title, year, payload.url);
      return "native";
    } catch {
      // A broken bridge must not break the page; fall through to the web APIs.
    }
  }

  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  if (nav && typeof nav.share === "function") {
    try {
      await nav.share(payload);
      return "system";
    } catch (error) {
      const name = (error as { name?: string } | null)?.name;
      if (name === "AbortError") return "cancelled";
    }
  }

  try {
    if (nav?.clipboard?.writeText) {
      await nav.clipboard.writeText(payload.text);
      return "copied";
    }
  } catch {
    // Clipboard permission can be denied; report it rather than throwing.
  }

  return "unavailable";
}
