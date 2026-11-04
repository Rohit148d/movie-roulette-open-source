"use client";

import type { CSSProperties } from "react";
import { Poster } from "@/components/Poster";
import {
  ArrowIcon,
  CheckIcon,
  ExternalIcon,
  PlayIcon,
  ShareIcon,
  StarIcon,
  TicketIcon,
} from "@/components/icons";
import { languageName } from "@/lib/constants";
import type { Movie } from "@/lib/tmdb/types";
import { formatRuntime, formatScore, formatVotes, formatYear } from "@/lib/format";

interface MovieResultProps {
  movie: Movie;
  reel: string;
  source: "live" | "demo";
  isWatchlisted: boolean;
  onSpin: () => void;
  onToggleWatchlist: (movie: Movie) => void;
  onShare: (movie: Movie) => void;
}

type BackdropStyle = CSSProperties & { "--backdrop"?: string; "--score"?: string };

export function MovieResult({
  movie,
  reel,
  source,
  isWatchlisted,
  onSpin,
  onToggleWatchlist,
  onShare,
}: MovieResultProps) {
  const style: BackdropStyle = {
    "--backdrop": movie.backdropUrl ? `url("${movie.backdropUrl}")` : "none",
    "--score": `${Math.max(0, Math.min(100, movie.voteAverage * 10))}%`,
  };
  const titleId = `movie-title-${movie.id}`;
  const trailer = movie.trailer ?? null;

  return (
    <article
      className="movie-result"
      style={style}
      aria-labelledby={titleId}
      data-movie-id={movie.id}
      data-genres={movie.genres.map((genre) => genre.id).join(",")}
      data-runtime={movie.runtime ?? ""}
      data-rating={movie.voteAverage}
      data-votes={movie.voteCount}
      data-year={movie.releaseYear ?? ""}
      data-language={movie.language}
    >
      <div className="movie-backdrop" aria-hidden="true" />
      <div className="movie-poster-column">
        <div className="poster-frame">
          <Poster src={movie.posterUrl} title={movie.title} priority />
          <span className="poster-corner poster-corner-tl" aria-hidden="true" />
          <span className="poster-corner poster-corner-br" aria-hidden="true" />
        </div>
        <p className="poster-caption">
          <TicketIcon className="inline-icon" /> Reel {reel}
          {source === "demo" ? " · demo print" : ""}
        </p>
      </div>

      <div className="movie-copy">
        <p className="eyebrow">
          <span className="live-dot" aria-hidden="true" /> Now showing
          <span className="eyebrow-separator">/</span>
          <span>Reel {reel}</span>
        </p>
        <h2 className="movie-title" id={titleId}>
          {movie.title}
        </h2>
        {movie.tagline ? <p className="movie-tagline">“{movie.tagline}”</p> : null}

        <div className="movie-meta" aria-label="Movie details">
          <span>{formatYear(movie.releaseYear)}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{formatRuntime(movie.runtime)}</span>
          <span className="meta-dot" aria-hidden="true" />
          <span>{languageName(movie.language)}</span>
          {movie.director ? (
            <>
              <span className="meta-dot" aria-hidden="true" />
              <span>Dir. {movie.director}</span>
            </>
          ) : null}
        </div>

        <div className="score-row">
          <div
            className="score-ring"
            role="img"
            aria-label={`${formatScore(movie.voteAverage)} out of 10 from ${formatVotes(movie.voteCount)}`}
          >
            <div className="score-ring-inner">
              <StarIcon className="score-star" />
              <strong>{formatScore(movie.voteAverage)}</strong>
            </div>
          </div>
          <div className="score-copy">
            <span className="score-label">TMDB audience score</span>
            <span className="score-votes">{formatVotes(movie.voteCount)}</span>
          </div>
          <div className="genre-list" aria-label="Genres">
            {movie.genres.slice(0, 4).map((genre) => (
              <span className="genre-tag" key={genre.id}>
                {genre.name}
              </span>
            ))}
          </div>
        </div>

        <p className="movie-overview">{movie.overview}</p>

        <div className="movie-actions">
          <button type="button" className="button button-gold" onClick={onSpin}>
            Spin again <ArrowIcon className="button-icon" />
          </button>
          <button
            type="button"
            className={`button button-outline ${isWatchlisted ? "is-saved" : ""}`}
            aria-pressed={isWatchlisted}
            onClick={() => onToggleWatchlist(movie)}
          >
            {isWatchlisted ? <CheckIcon className="button-icon" /> : <TicketIcon className="button-icon" />}
            {isWatchlisted ? "Saved to watchlist" : "Save to watchlist"}
          </button>
          <a
            className="button button-ghost"
            href={movie.tmdbUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`View ${movie.title} on TMDB (opens in a new tab)`}
          >
            TMDB <ExternalIcon className="button-icon" />
          </a>
        </div>

        <div className="movie-actions movie-actions-secondary">
          {trailer ? (
            <a
              className="button button-outline"
              href={trailer.url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Watch the ${movie.title} trailer on YouTube (opens in a new tab)`}
              data-testid="trailer-link"
            >
              <PlayIcon className="button-icon" /> Watch trailer
            </a>
          ) : null}
          <button
            type="button"
            className="button button-ghost"
            onClick={() => onShare(movie)}
            aria-label={`Share ${movie.title}`}
          >
            <ShareIcon className="button-icon" /> Share
          </button>
        </div>
      </div>
    </article>
  );
}
