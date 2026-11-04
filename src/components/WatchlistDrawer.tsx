"use client";

import { useEffect, useRef, useState } from "react";
import { Poster } from "@/components/Poster";
import { CloseIcon, FilmIcon, TrashIcon } from "@/components/icons";
import type { Movie } from "@/lib/tmdb/types";
import { formatRuntime, formatYear } from "@/lib/format";

interface WatchlistDrawerProps {
  open: boolean;
  items: Movie[];
  onClose: () => void;
  onRemove: (id: number) => void;
  onSelect: (movie: Movie) => void;
  onClear: () => void;
}

export function WatchlistDrawer({
  open,
  items,
  onClose,
  onRemove,
  onSelect,
  onClear,
}: WatchlistDrawerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      setConfirmClear(false);
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={dialogRef}
      className="watchlist-dialog"
      aria-labelledby="watchlist-title"
      onClose={() => {
        setConfirmClear(false);
        if (open) onClose();
      }}
      onClick={(event) => {
        if (event.target === dialogRef.current) onClose();
      }}
    >
      <div className="watchlist-sheet">
        <header className="watchlist-header">
          <div>
            <p className="eyebrow eyebrow-small">Your private screening list</p>
            <h2 id="watchlist-title">
              Watchlist <span className="watchlist-count">{items.length}</span>
            </h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close watchlist">
            <CloseIcon />
          </button>
        </header>

        {items.length === 0 ? (
          <div className="watchlist-empty">
            <FilmIcon className="watchlist-empty-icon" />
            <h3>No tickets reserved yet</h3>
            <p>Save a film after you spin and it will wait for you here.</p>
            <button type="button" className="button button-outline" onClick={onClose}>
              Back to the reel
            </button>
          </div>
        ) : (
          <>
            <ul className="watchlist-items">
              {items.map((movie) => (
                <li className="watchlist-item" key={movie.id}>
                  <button
                    type="button"
                    className="watchlist-select"
                    onClick={() => onSelect(movie)}
                    aria-label={`Show ${movie.title}`}
                  >
                    <span className="watchlist-poster">
                      <Poster src={movie.posterUrl} title={movie.title} />
                    </span>
                    <span className="watchlist-copy">
                      <strong>{movie.title}</strong>
                      <span>
                        {formatYear(movie.releaseYear)} · {formatRuntime(movie.runtime)}
                      </span>
                      <span className="watchlist-score">
                        {movie.voteAverage.toFixed(1)} ★
                      </span>
                    </span>
                  </button>
                  <button
                    type="button"
                    className="icon-button icon-button-danger"
                    onClick={() => onRemove(movie.id)}
                    aria-label={`Remove ${movie.title} from watchlist`}
                  >
                    <TrashIcon />
                  </button>
                </li>
              ))}
            </ul>
            <footer className="watchlist-footer">
              <p>Saved only in this browser. Nothing leaves your device.</p>
              {confirmClear ? (
                <div className="clear-confirm">
                  <span>Remove all {items.length}?</span>
                  <button
                    type="button"
                    className="text-button text-button-danger"
                    onClick={() => {
                      onClear();
                      setConfirmClear(false);
                    }}
                  >
                    Yes, clear
                  </button>
                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setConfirmClear(false)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="text-button text-button-danger"
                  onClick={() => setConfirmClear(true)}
                >
                  Clear watchlist
                </button>
              )}
            </footer>
          </>
        )}
      </div>
    </dialog>
  );
}
