"use client";

import { Poster } from "@/components/Poster";
import type { Movie } from "@/lib/tmdb/types";
import { formatYear } from "@/lib/format";

interface HistoryStripProps {
  history: Movie[];
  currentId: number | null;
  onSelect: (movie: Movie) => void;
}

export function HistoryStrip({ history, currentId, onSelect }: HistoryStripProps) {
  if (history.length < 2) return null;

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="history-heading">
        <h2 id="history-title">Earlier tonight</h2>
        <span>{history.length} spins this session</span>
      </div>
      <ul className="history-list">
        {history.map((movie) => (
          <li key={movie.id}>
            <button
              type="button"
              className={`history-card ${currentId === movie.id ? "is-current" : ""}`}
              onClick={() => onSelect(movie)}
              aria-label={`Show ${movie.title}, ${formatYear(movie.releaseYear)}`}
              aria-current={currentId === movie.id ? "true" : undefined}
            >
              <span className="history-poster">
                <Poster src={movie.posterUrl} title={movie.title} />
              </span>
              <span className="history-copy">
                <strong>{movie.title}</strong>
                <span>
                  {formatYear(movie.releaseYear)} · {movie.voteAverage.toFixed(1)} ★
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
