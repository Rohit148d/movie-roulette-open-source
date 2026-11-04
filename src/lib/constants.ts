export interface GenreOption {
  id: number;
  name: string;
}

/** TMDB's stable movie genre ids (https://developer.themoviedb.org/reference/genre-movie-list). */
export const GENRES: readonly GenreOption[] = [
  { id: 28, name: "Action" },
  { id: 12, name: "Adventure" },
  { id: 16, name: "Animation" },
  { id: 35, name: "Comedy" },
  { id: 80, name: "Crime" },
  { id: 99, name: "Documentary" },
  { id: 18, name: "Drama" },
  { id: 10751, name: "Family" },
  { id: 14, name: "Fantasy" },
  { id: 36, name: "History" },
  { id: 27, name: "Horror" },
  { id: 10402, name: "Music" },
  { id: 9648, name: "Mystery" },
  { id: 10749, name: "Romance" },
  { id: 878, name: "Science Fiction" },
  { id: 10770, name: "TV Movie" },
  { id: 53, name: "Thriller" },
  { id: 10752, name: "War" },
  { id: 37, name: "Western" },
] as const;

export const GENRE_IDS: ReadonlySet<number> = new Set(GENRES.map((genre) => genre.id));

export interface LanguageOption {
  code: string;
  name: string;
}

/** A compact set of common original-language codes supported by TMDB Discover. */
export const LANGUAGES: readonly LanguageOption[] = [
  { code: "en", name: "English" },
  { code: "es", name: "Spanish" },
  { code: "fr", name: "French" },
  { code: "de", name: "German" },
  { code: "it", name: "Italian" },
  { code: "pt", name: "Portuguese" },
  { code: "ja", name: "Japanese" },
  { code: "ko", name: "Korean" },
  { code: "hi", name: "Hindi" },
  { code: "zh", name: "Chinese" },
  { code: "ru", name: "Russian" },
  { code: "sv", name: "Swedish" },
  { code: "da", name: "Danish" },
  { code: "no", name: "Norwegian" },
  { code: "nl", name: "Dutch" },
  { code: "pl", name: "Polish" },
  { code: "tr", name: "Turkish" },
  { code: "ar", name: "Arabic" },
  { code: "th", name: "Thai" },
  { code: "id", name: "Indonesian" },
] as const;

export const LANGUAGE_CODES = LANGUAGES.map((language) => language.code);

export function genreName(id: number): string {
  return GENRES.find((genre) => genre.id === id)?.name ?? "Movie";
}

export function languageName(code: string): string {
  return LANGUAGES.find((language) => language.code === code)?.name ?? code.toUpperCase();
}
