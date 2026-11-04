"use client";

import { useState } from "react";
import { FilmIcon } from "@/components/icons";

interface PosterProps {
  src: string | null;
  title: string;
  className?: string;
  priority?: boolean;
}

export function Poster({ src, title, className = "", priority = false }: PosterProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`poster-fallback ${className}`}
        role="img"
        aria-label={`${title} — poster not available`}
      >
        <span className="poster-fallback-lines" aria-hidden="true" />
        <FilmIcon className="poster-fallback-icon" />
        <span className="poster-fallback-title">{title}</span>
        <span className="poster-fallback-note">Poster unavailable</span>
      </div>
    );
  }

  return (
    // TMDB's CDN is allow-listed in the CSP. A plain img avoids requiring the
    // Next image optimizer on Cloudflare Workers.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={`poster-image ${className}`}
      src={src}
      alt={`${title} poster`}
      width={500}
      height={750}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
