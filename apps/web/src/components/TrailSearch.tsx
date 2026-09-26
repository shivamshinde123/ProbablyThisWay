import { useId, useRef, useState } from "react";
import {
  internetTrailSearchResponseSchema,
  type HikeDetail,
  type InternetTrailResult,
} from "@probably-this-way/contracts";

type TrailSearchProps = {
  apiBaseUrl: string;
  hike?: HikeDetail;
  selectedRouteId?: string;
  selectedInternetTrailId?: string;
  disabled: boolean;
  onSelectRoute: (routeId: string) => void;
  onSelectInternetTrail: (trail: InternetTrailResult) => void;
};

export function TrailSearch({
  apiBaseUrl,
  hike,
  selectedRouteId,
  selectedInternetTrailId,
  disabled,
  onSelectRoute,
  onSelectInternetTrail,
}: TrailSearchProps) {
  const inputId = useId();
  const requestSequence = useRef(0);
  const [query, setQuery] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState<string>();
  const [internetTrails, setInternetTrails] = useState<InternetTrailResult[]>(
    [],
  );
  const [searchStatus, setSearchStatus] = useState<
    "idle" | "searching" | "ready" | "error"
  >("idle");
  const normalizedQuery = submittedQuery?.trim().toLocaleLowerCase() ?? "";
  const reviewedMatches =
    hike?.routes.filter((route) => {
      if (!normalizedQuery) return true;
      return [route.properties.name, hike.name, hike.location].some((value) =>
        value.toLocaleLowerCase().includes(normalizedQuery),
      );
    }) ?? [];

  async function searchInternet() {
    const normalized = query.trim();
    if (normalized.length < 2 || disabled) return;
    const sequence = ++requestSequence.current;
    setSubmittedQuery(normalized);
    setInternetTrails([]);
    setSearchStatus("searching");
    try {
      const response = await fetch(
        apiBaseUrl + "/trails/search?q=" + encodeURIComponent(normalized),
      );
      if (!response.ok)
        throw new Error("Trail search returned " + response.status);
      const result = internetTrailSearchResponseSchema.parse(
        await response.json(),
      );
      if (sequence !== requestSequence.current) return;
      setInternetTrails(result.items);
      setSearchStatus("ready");
    } catch {
      if (sequence !== requestSequence.current) return;
      setSearchStatus("error");
    }
  }

  const hasResults = reviewedMatches.length > 0 || internetTrails.length > 0;

  return (
    <section className="trail-search" aria-labelledby={inputId + "-label"}>
      <div className="trail-search-heading">
        <div>
          <span>Trail index / internet + reviewed</span>
          <strong id={inputId + "-label"}>Find any trail</strong>
        </div>
        <small>OpenStreetMap search</small>
      </div>
      <form
        className="trail-search-form"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          void searchInternet();
        }}
      >
        <label className="sr-only" htmlFor={inputId}>
          Search trails from the internet
        </label>
        <input
          id={inputId}
          type="search"
          value={query}
          disabled={disabled}
          placeholder="Trail name and location"
          onChange={(event) => setQuery(event.target.value)}
        />
        <button type="submit" disabled={disabled || query.trim().length < 2}>
          {searchStatus === "searching" ? "Searching…" : "Search"}
        </button>
      </form>
      {submittedQuery !== undefined ? (
        <div className="trail-search-results" aria-live="polite">
          {hasResults ? (
            <ul>
              {reviewedMatches.map((route) => (
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
                    <small>{hike?.location} · reviewed route</small>
                    <b>{route.properties.distanceMiles} mi</b>
                  </button>
                </li>
              ))}
              {internetTrails.map((trail) => (
                <li key={trail.id}>
                  <button
                    type="button"
                    aria-pressed={trail.id === selectedInternetTrailId}
                    onClick={() => {
                      onSelectInternetTrail(trail);
                      setSubmittedQuery(undefined);
                      setQuery(trail.name);
                    }}
                  >
                    <span>{trail.name}</span>
                    <small>{trail.location} · internet preview</small>
                    <b>{trail.distanceMiles.toFixed(2)} mi</b>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
          {searchStatus === "searching" ? (
            <p>Searching the OpenStreetMap trail index…</p>
          ) : null}
          {searchStatus === "ready" && !hasResults ? (
            <p>
              No line-mapped trail matched. Add a city, state, or country to
              make the search more specific.
            </p>
          ) : null}
          {searchStatus === "error" ? (
            <p>
              Internet trail search is temporarily unavailable. The reviewed
              Wachusett routes remain available.
            </p>
          ) : null}
          {searchStatus === "ready" ? (
            <p className="trail-search-attribution">
              Search data ©{" "}
              <a
                href="https://www.openstreetmap.org/copyright"
                target="_blank"
                rel="noreferrer"
              >
                OpenStreetMap contributors
              </a>
            </p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
