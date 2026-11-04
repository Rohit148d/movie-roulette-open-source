export interface TmdbGenre {
  id: number;
  name: string;
}

export interface TmdbDiscoverResult {
  id: number;
  title: string;
  original_title: string;
  overview: string;
  release_date?: string;
  vote_average: number;
  vote_count: number;
  popularity: number;
  genre_ids: number[];
  original_language: string;
  poster_path: string | null;
  backdrop_path: string | null;
  adult?: boolean;
  video?: boolean;
}

export interface TmdbDiscoverResponse {
  page: number;
  total_pages: number;
  total_results: number;
  results: TmdbDiscoverResult[];
}

export interface TmdbCrewMember {
  job?: string;
  department?: string;
  name?: string;
}

export interface TmdbVideo {
  key?: string;
  site?: string;
  type?: string;
  official?: boolean;
  name?: string;
  iso_639_1?: string;
  published_at?: string;
}

export interface TmdbMovieDetails {
  id: number;
  title: string;
  original_title?: string;
  overview?: string;
  tagline?: string | null;
  release_date?: string;
  runtime?: number | null;
  vote_average: number;
  vote_count: number;
  popularity?: number;
  genres?: TmdbGenre[];
  original_language?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  adult?: boolean;
  video?: boolean;
  status?: string;
  homepage?: string | null;
  imdb_id?: string | null;
  credits?: {
    crew?: TmdbCrewMember[];
  };
  videos?: {
    results?: TmdbVideo[];
  };
}

export interface MovieTrailer {
  /** YouTube video id, e.g. "dQw4w9WgXcQ". */
  key: string;
  name: string;
  site: "YouTube";
  url: string;
}

export interface Movie {
  id: number;
  title: string;
  originalTitle: string;
  overview: string;
  tagline: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  runtime: number | null;
  voteAverage: number;
  voteCount: number;
  genres: TmdbGenre[];
  language: string;
  director: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  tmdbUrl: string;
  /** Optional so watchlists saved before v1.0.1 still load. */
  trailer?: MovieTrailer | null;
}

export interface DiscoverPool {
  totalResults: number;
  totalPages: number;
  eligiblePages: number;
  scannedPages: number;
}

export interface RandomMovieResult {
  movie: Movie;
  pool: DiscoverPool;
  attempts: number;
  source: "live" | "demo";
}
