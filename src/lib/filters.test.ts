import { describe, expect, it } from "vitest";
import {
  activeFilterCount,
  defaultFilters,
  filtersToSearchParams,
  parseFiltersFromSearchParams,
  validateStoredFilters,
} from "@/lib/filters";

function parse(query: string) {
  return parseFiltersFromSearchParams(new URLSearchParams(query));
}

describe("parseFiltersFromSearchParams", () => {
  it("applies house defaults when no filters are supplied", () => {
    const result = parse("");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filters).toEqual({
      ...defaultFilters(),
      runtimeMin: null,
      runtimeMax: null,
    });
    expect(result.excludeIds).toEqual([]);
  });

  it("parses a complete, valid filter set", () => {
    const result = parse(
      "genres=28,12&language=en&yearFrom=1990&yearTo=2020&minRating=7.5&minVotes=500&runtimeMin=90&runtimeMax=150&exclude=1,2,2",
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.filters).toMatchObject({
      genres: [28, 12],
      language: "en",
      yearFrom: 1990,
      yearTo: 2020,
      minRating: 7.5,
      minVotes: 500,
      runtimeMin: 90,
      runtimeMax: 150,
    });
    expect(result.excludeIds).toEqual([1, 2]);
  });

  it("treats empty numeric parameters as unset", () => {
    const result = parse("genres=&runtimeMin=&runtimeMax=&minRating=");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Blank runtime bounds mean "any runtime" rather than a default window.
    expect(result.filters.runtimeMin).toBeNull();
    expect(result.filters.runtimeMax).toBeNull();
    expect(result.filters.minRating).toBe(defaultFilters().minRating);
  });

  it.each([
    ["unknown genre", "genres=999999"],
    ["inverted year range", "yearFrom=2020&yearTo=1990"],
    ["future end year", `yearTo=${new Date().getFullYear() + 2}`],
    ["inverted runtime", "runtimeMin=150&runtimeMax=90"],
    ["invalid language", "language=xx"],
    ["rating above 10", "minRating=11"],
    ["negative votes", "minVotes=-1"],
    ["non-numeric runtime", "runtimeMin=abc"],
  ])("rejects %s", (_label, query) => {
    const result = parse(query);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message.length).toBeGreaterThan(0);
  });

  it("rejects an exclude list larger than the session cap", () => {
    const ids = Array.from({ length: 101 }, (_, index) => index + 1).join(",");
    const result = parse(`exclude=${ids}`);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.fields.exclude?.[0]).toMatch(/100/);
  });

  it("rejects more than ten genres", () => {
    const result = parse("genres=28,12,16,35,80,99,18,10751,14,36,27");
    expect(result.ok).toBe(false);
  });
});

describe("filtersToSearchParams", () => {
  it("round-trips all filters and excludes", () => {
    const filters = {
      ...defaultFilters(),
      genres: [53, 28],
      language: "ja",
      yearFrom: 1980,
      yearTo: 2001,
      minRating: 8,
      minVotes: 1000,
      runtimeMin: 95,
      runtimeMax: 130,
    };
    const params = filtersToSearchParams(filters, [42, 7]);
    const parsed = parseFiltersFromSearchParams(params);
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.filters).toEqual(filters);
    expect(parsed.excludeIds).toEqual([42, 7]);
  });

  it("omits optional values that are unset", () => {
    const filters = { ...defaultFilters(), genres: [], runtimeMin: null, runtimeMax: null };
    const params = filtersToSearchParams(filters);
    expect(params.has("genres")).toBe(false);
    expect(params.has("language")).toBe(false);
    expect(params.has("runtimeMin")).toBe(false);
    expect(params.has("runtimeMax")).toBe(false);
    expect(params.has("exclude")).toBe(false);
  });
});

describe("validateStoredFilters", () => {
  it("accepts a valid persisted filter object", () => {
    expect(validateStoredFilters(defaultFilters())).toEqual(defaultFilters());
  });

  it("rejects malformed or out-of-range persisted values", () => {
    expect(validateStoredFilters(null)).toBeNull();
    expect(validateStoredFilters("nope")).toBeNull();
    expect(validateStoredFilters({ ...defaultFilters(), minRating: 99 })).toBeNull();
    expect(validateStoredFilters({ ...defaultFilters(), genres: [999999] })).toBeNull();
  });
});

describe("activeFilterCount", () => {
  it("counts changed filter dimensions", () => {
    expect(activeFilterCount(defaultFilters())).toBe(0);
    expect(
      activeFilterCount({
        ...defaultFilters(),
        genres: [28],
        language: "en",
        minRating: 8,
      }),
    ).toBe(3);
  });
});
