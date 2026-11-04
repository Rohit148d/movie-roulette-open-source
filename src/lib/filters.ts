import { z } from "zod";
import { GENRE_IDS, LANGUAGE_CODES } from "@/lib/constants";

export const MAX_EXCLUDED_IDS = 100;
const MIN_YEAR = 1888;

export function currentYear(): number {
  return new Date().getFullYear();
}

export interface Filters {
  genres: number[];
  language?: string;
  yearFrom: number;
  yearTo: number;
  minRating: number;
  minVotes: number;
  runtimeMin: number | null;
  runtimeMax: number | null;
}

export function defaultFilters(): Filters {
  return {
    genres: [],
    yearFrom: 1970,
    yearTo: currentYear(),
    minRating: 6.5,
    minVotes: 250,
    runtimeMin: 80,
    runtimeMax: 180,
  };
}

const filtersSchema = z
  .object({
    genres: z
      .array(z.number().int())
      .max(10, "Choose at most 10 genres.")
      .default([])
      .refine(
        (genres) => genres.every((id) => GENRE_IDS.has(id)),
        "One or more genre ids are not valid TMDB movie genres.",
      ),
    language: z.enum(LANGUAGE_CODES).optional(),
    yearFrom: z.number().int().min(MIN_YEAR).max(2100),
    yearTo: z.number().int().min(MIN_YEAR).max(2100),
    minRating: z.number().min(0).max(10),
    minVotes: z.number().int().min(0).max(5_000_000),
    runtimeMin: z.number().int().min(0).max(600).nullable(),
    runtimeMax: z.number().int().min(0).max(600).nullable(),
  })
  .refine((filters) => filters.yearFrom <= filters.yearTo, {
    message: "The start year must be before the end year.",
    path: ["yearFrom"],
  })
  .refine(
    (filters) =>
      filters.runtimeMin === null ||
      filters.runtimeMax === null ||
      filters.runtimeMin <= filters.runtimeMax,
    {
      message: "Minimum runtime must not exceed maximum runtime.",
      path: ["runtimeMin"],
    },
  )
  .refine((filters) => filters.yearTo <= currentYear() + 1, {
    message: "The end year cannot be in the future.",
    path: ["yearTo"],
  });

const excludeSchema = z
  .array(z.number().int().positive())
  .max(MAX_EXCLUDED_IDS, `At most ${MAX_EXCLUDED_IDS} previously seen movies can be excluded.`);

export interface ParseFiltersSuccess {
  ok: true;
  filters: Filters;
  excludeIds: number[];
}

export interface ParseFiltersFailure {
  ok: false;
  message: string;
  fields: Record<string, string[]>;
}

export type ParseFiltersResult = ParseFiltersSuccess | ParseFiltersFailure;

function numberParam(value: string | null, fallback: number): number {
  if (value === null || value.trim() === "") return fallback;
  return Number(value);
}

function nullableNumberParam(value: string | null): number | null {
  if (value === null || value.trim() === "") return null;
  return Number(value);
}

function idListParam(value: string | null): number[] {
  if (!value) return [];
  const ids = value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .map(Number);
  return [...new Set(ids)];
}

/**
 * Parses untrusted query-string input into a fully typed filter object.
 * Numeric bounds, genre ids, language codes and cross-field constraints are
 * validated before any request reaches TMDB.
 */
export function parseFiltersFromSearchParams(params: URLSearchParams): ParseFiltersResult {
  const defaults = defaultFilters();
  const raw = {
    genres: idListParam(params.get("genres")),
    language: params.get("language")?.trim() || undefined,
    yearFrom: numberParam(params.get("yearFrom"), defaults.yearFrom),
    yearTo: numberParam(params.get("yearTo"), defaults.yearTo),
    minRating: numberParam(params.get("minRating"), defaults.minRating),
    minVotes: numberParam(params.get("minVotes"), defaults.minVotes),
    runtimeMin: nullableNumberParam(params.get("runtimeMin")),
    runtimeMax: nullableNumberParam(params.get("runtimeMax")),
  };

  const parsedFilters = filtersSchema.safeParse(raw);
  if (!parsedFilters.success) {
    const flattened = z.flattenError(parsedFilters.error);
    const fields = Object.fromEntries(
      Object.entries(flattened.fieldErrors).map(([field, messages]) => [
        field,
        (messages ?? []).filter(Boolean),
      ]),
    );
    const firstMessage =
      flattened.formErrors[0] ??
      Object.values(fields).flat()[0] ??
      "Some filters are invalid.";
    return { ok: false, message: firstMessage, fields };
  }

  const parsedExclude = excludeSchema.safeParse(idListParam(params.get("exclude")));
  if (!parsedExclude.success) {
    return {
      ok: false,
      message: parsedExclude.error.issues[0]?.message ?? "Invalid exclude list.",
      fields: { exclude: [parsedExclude.error.issues[0]?.message ?? "Invalid exclude list."] },
    };
  }

  return { ok: true, filters: parsedFilters.data, excludeIds: parsedExclude.data };
}

/** Builds the query string used by the browser to request a random movie. */
export function filtersToSearchParams(filters: Filters, excludeIds: number[] = []): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.genres.length > 0) params.set("genres", filters.genres.join(","));
  if (filters.language) params.set("language", filters.language);
  params.set("yearFrom", String(filters.yearFrom));
  params.set("yearTo", String(filters.yearTo));
  params.set("minRating", String(filters.minRating));
  params.set("minVotes", String(filters.minVotes));
  if (filters.runtimeMin !== null) params.set("runtimeMin", String(filters.runtimeMin));
  if (filters.runtimeMax !== null) params.set("runtimeMax", String(filters.runtimeMax));
  if (excludeIds.length > 0) params.set("exclude", excludeIds.join(","));
  return params;
}

/** Stable key for the candidate pool, excluding session-specific excludes. */
export function filterSignature(filters: Filters): string {
  return JSON.stringify([
    [...filters.genres].sort((a, b) => a - b),
    filters.language ?? "",
    filters.yearFrom,
    filters.yearTo,
    filters.minRating,
    filters.minVotes,
    filters.runtimeMin,
    filters.runtimeMax,
  ]);
}

export function activeFilterCount(filters: Filters): number {
  const defaults = defaultFilters();
  let count = 0;
  if (filters.genres.length > 0) count += 1;
  if (filters.language) count += 1;
  if (filters.yearFrom !== defaults.yearFrom || filters.yearTo !== defaults.yearTo) count += 1;
  if (filters.minRating !== defaults.minRating) count += 1;
  if (filters.minVotes !== defaults.minVotes) count += 1;
  if (filters.runtimeMin !== defaults.runtimeMin || filters.runtimeMax !== defaults.runtimeMax) {
    count += 1;
  }
  return count;
}

/** Validates a persisted filter object loaded from localStorage. */
export function validateStoredFilters(value: unknown): Filters | null {
  if (typeof value !== "object" || value === null) return null;
  const parsed = filtersSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}
