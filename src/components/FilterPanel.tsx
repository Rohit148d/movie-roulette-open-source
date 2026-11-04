"use client";

import { useId } from "react";
import { GENRES, LANGUAGES } from "@/lib/constants";
import { activeFilterCount, currentYear, type Filters } from "@/lib/filters";
import { ArrowIcon, CloseIcon, FilterIcon } from "@/components/icons";

interface FilterPanelProps {
  filters: Filters;
  onChange: (filters: Filters) => void;
  onReset: () => void;
  onSpin: () => void;
  onClose?: () => void;
  spinning: boolean;
}

const VOTE_OPTIONS = [0, 100, 250, 500, 1000, 2500, 5000, 10000];

function clampRuntime(value: number): number {
  return Math.max(0, Math.min(600, Math.round(value)));
}

export function FilterPanel({
  filters,
  onChange,
  onReset,
  onSpin,
  onClose,
  spinning,
}: FilterPanelProps) {
  const prefix = useId();
  const years = Array.from({ length: currentYear() - 1899 }, (_, index) => currentYear() - index);
  const activeCount = activeFilterCount(filters);

  const update = (patch: Partial<Filters>) => onChange({ ...filters, ...patch });

  const toggleGenre = (id: number) => {
    if (filters.genres.includes(id)) {
      update({ genres: filters.genres.filter((genre) => genre !== id) });
    } else if (filters.genres.length < 10) {
      update({ genres: [...filters.genres, id] });
    }
  };

  const setYearFrom = (yearFrom: number) => {
    update({ yearFrom, yearTo: Math.max(yearFrom, filters.yearTo) });
  };

  const setYearTo = (yearTo: number) => {
    update({ yearTo, yearFrom: Math.min(yearTo, filters.yearFrom) });
  };

  const setRuntimeMin = (value: string) => {
    if (value === "") {
      update({ runtimeMin: null });
      return;
    }
    const runtimeMin = clampRuntime(Number(value));
    update({
      runtimeMin,
      runtimeMax: filters.runtimeMax === null ? null : Math.max(runtimeMin, filters.runtimeMax),
    });
  };

  const setRuntimeMax = (value: string) => {
    if (value === "") {
      update({ runtimeMax: null });
      return;
    }
    const runtimeMax = clampRuntime(Number(value));
    update({
      runtimeMax,
      runtimeMin: filters.runtimeMin === null ? null : Math.min(runtimeMax, filters.runtimeMin),
    });
  };

  return (
    <div className="filter-panel">
      <div className="filter-heading">
        <div>
          <p className="eyebrow eyebrow-small">
            <FilterIcon className="inline-icon" /> The mood board
          </p>
          <h2 className="filter-title">Set the scene</h2>
        </div>
        {onClose ? (
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close filters">
            <CloseIcon />
          </button>
        ) : (
          <span className="filter-count" aria-label={`${activeCount} active filters`}>
            {activeCount}
          </span>
        )}
      </div>

      <fieldset className="filter-group">
        <legend>
          Genres <span className="legend-note">must match all</span>
        </legend>
        <div className="genre-grid">
          {GENRES.map((genre) => {
            const selected = filters.genres.includes(genre.id);
            return (
              <button
                key={genre.id}
                type="button"
                className={`genre-chip ${selected ? "is-selected" : ""}`}
                aria-pressed={selected}
                onClick={() => toggleGenre(genre.id)}
                disabled={!selected && filters.genres.length >= 10}
              >
                {genre.name}
              </button>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Release &amp; language</legend>
        <div className="filter-grid">
          <label className="field" htmlFor={`${prefix}-language`}>
            <span className="field-label">Original language</span>
            <select
              id={`${prefix}-language`}
              className="select"
              value={filters.language ?? ""}
              onChange={(event) =>
                update({ language: event.target.value || undefined })
              }
            >
              <option value="">Any language</option>
              {LANGUAGES.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </label>

          <div className="field">
            <span className="field-label" id={`${prefix}-year-label`}>
              Release years
            </span>
            <div className="range-row" role="group" aria-labelledby={`${prefix}-year-label`}>
              <label className="sr-only" htmlFor={`${prefix}-year-from`}>
                From year
              </label>
              <select
                id={`${prefix}-year-from`}
                className="select"
                value={filters.yearFrom}
                onChange={(event) => setYearFrom(Number(event.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
              <span className="range-dash" aria-hidden="true">
                –
              </span>
              <label className="sr-only" htmlFor={`${prefix}-year-to`}>
                To year
              </label>
              <select
                id={`${prefix}-year-to`}
                className="select"
                value={filters.yearTo}
                onChange={(event) => setYearTo(Number(event.target.value))}
              >
                {years.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Runtime</legend>
        <div className="range-row">
          <label className="field" htmlFor={`${prefix}-runtime-min`}>
            <span className="field-label">Min minutes</span>
            <input
              id={`${prefix}-runtime-min`}
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              step={5}
              placeholder="Any"
              value={filters.runtimeMin ?? ""}
              onChange={(event) => setRuntimeMin(event.target.value)}
            />
          </label>
          <span className="range-dash" aria-hidden="true">
            –
          </span>
          <label className="field" htmlFor={`${prefix}-runtime-max`}>
            <span className="field-label">Max minutes</span>
            <input
              id={`${prefix}-runtime-max`}
              className="input"
              type="number"
              inputMode="numeric"
              min={0}
              max={600}
              step={5}
              placeholder="Any"
              value={filters.runtimeMax ?? ""}
              onChange={(event) => setRuntimeMax(event.target.value)}
            />
          </label>
        </div>
      </fieldset>

      <fieldset className="filter-group">
        <legend>Audience score</legend>
        <label className="field" htmlFor={`${prefix}-rating`}>
          <span className="field-label field-label-inline">
            Minimum rating <output htmlFor={`${prefix}-rating`}>{filters.minRating.toFixed(1)}</output>
          </span>
          <input
            id={`${prefix}-rating`}
            className="range"
            type="range"
            min={0}
            max={10}
            step={0.5}
            value={filters.minRating}
            onChange={(event) => update({ minRating: Number(event.target.value) })}
          />
        </label>

        <label className="field" htmlFor={`${prefix}-votes`}>
          <span className="field-label">Minimum votes</span>
          <select
            id={`${prefix}-votes`}
            className="select"
            value={filters.minVotes}
            onChange={(event) => update({ minVotes: Number(event.target.value) })}
          >
            {VOTE_OPTIONS.map((votes) => (
              <option key={votes} value={votes}>
                {votes === 0 ? "Any number of votes" : `${votes.toLocaleString("en-US")}+ votes`}
              </option>
            ))}
          </select>
        </label>
      </fieldset>

      <div className="filter-footer">
        <button
          type="button"
          className="button button-gold button-wide"
          onClick={onSpin}
          disabled={spinning}
        >
          {spinning ? "Spinning…" : "Spin with these filters"}
          <ArrowIcon className="button-icon" />
        </button>
        <div className="filter-footer-row">
          <button type="button" className="text-button" onClick={onReset}>
            Reset filters
          </button>
          <span className="filter-footnote">Saved on this device</span>
        </div>
      </div>
    </div>
  );
}
