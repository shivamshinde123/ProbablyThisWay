import { useId, useState } from "react";
import type { HikeDetail } from "@probably-this-way/contracts";

type TrailSearchProps = {
  hike?: HikeDetail;
  selectedRouteId?: string;
  disabled: boolean;
  onSelectRoute: (routeId: string) => void;
};

export function TrailSearch({
  hike,
  selectedRouteId,
  disabled,
  onSelectRoute,
}: TrailSearchProps) {
  const inputId = useId();
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string>();
  const normalizedQuery = submittedQuery?.trim().toLocaleLowerCase() ?? "";
  const matches =
    hike?.routes.filter((route) => {
      if (!normalizedQuery) return true;
      return [route.properties.name, hike.name, hike.location].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );
    }) ?? [];

  return (
    <section className="trail-search" aria-labelledby={`${inputId}-label`}>
      <div className="trail-search-heading">
        <div>
          <span>Trail index / supported</span>
          <strong id={`${inputId}-label`}>Find a trail</strong>
        </div>
        <small>
          {hike ? `${hike.routes.length} trails · 1 area` : "Loading index"}
        </small>
      </div>
      <form
        className="trail-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          setSubmittedQuery(query);
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Search supported trails
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Trail name or location"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={disabled || !hike}>
          Search
        </button>
      </form>
      {submittedQuery !== undefined ? (
        <div className="trail-search-results" aria-live="polite">
          {matches.length > 0 ? (
            <ul>
              {matches.map((route) => (
                <li key={route.properties.id}>
                  <button
                    type="button"
                    aria-pressed={route.properties.id === selectedRouteId}
                    onClick={() => {
                      onSelectRoute(route.properties.id);
                      setSubmittedQuery(undefined);
                      setQuery(route.properties.name);
                    }}
                  >
                    <span>{route.properties.name}</span>
                    <small>{hike?.location}</small>
                    <b>{route.properties.distanceMiles} mi</b>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <p>
              No supported match. This release currently covers the three
              reviewed Wachusett summit trails.
            </p>
          )}
        </div>
      ) : null}
    </section>
  );
}
