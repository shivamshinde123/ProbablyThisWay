# Technical Design Document

## Session Flow

1. Client requests supported hikes and selects one.
2. API loads trail geometry, terrain references, and candidate routes.
3. At session start, the evaluation service loads the versioned route-suitability prompt and output schema.
4. The state service requests and validates configured live weather/daylight. Outside production only, provider absence/failure produces a visibly labeled static fallback.
5. OpenRouter evaluates every validated candidate route from the same snapshot; reviewed and search-derived provenance remain distinguishable.
6. Policy rejects hard-constraint violations, ranks remaining routes, and selects one or returns an explicit unavailable decision.
7. API persists the evaluation and emits a decision event.
8. Client updates route styling, cards, HUD, and feed.

## Re-Evaluation

`PATCH /api/v1/sessions/{sessionId}/state` validates supported source-specific changes and rejects observations whose timestamp is not newer than the session's current state. The detector compares the accumulated state with the last evaluated snapshot, not merely the preceding update. Thresholds are 10 F temperature, 5 mph wind, 0.15 rain probability, 10 minutes remaining daylight, 15% relative pace, and any fatigue-level change.

Every accepted update, including an automatic weather refresh, increments a session-scoped sequence. With live weather configured, a serialized background refresher lists durable active sessions every five minutes by default, deduplicates provider reads per hike, rejects duplicate/older observations, and preserves user state while replacing environmental fields. Provider failures retain the last valid state and decision. A threshold crossing runs evaluation synchronously in the current process. The complete state/decision/event transition is then saved with an expected prior sequence; PostgreSQL applies that comparison and the event writes in one transaction. A mismatch returns `409 state_update_conflict`, so an older concurrent request cannot overwrite newer state. Evaluation is deliberately synchronous in the supported single-replica topology. This process is automatic and has no user-facing evaluation control.

## Reliability

- Validate all external data at adapter boundaries.
- Make state/evaluation transitions atomic and compare-and-swap guarded so stale concurrent work cannot overwrite newer state.
- Time out external weather and OpenRouter calls explicitly.
- Retain the last valid recommendation when a refresh fails, atomically mark environmental status stale, and expose that state on every event-feed poll. Expire otherwise successful Open-Meteo observations after the configured 30-minute default ceiling.
- Never silently convert missing safety-relevant input into a favorable score.

## Security and Privacy

- Keep secrets server-side.
- Minimize stored location and user-state data.
- Delete inactive session snapshots and their decision events 30 days after the last successful write by default. This application does not collect personal GPS history; adding it requires a separate reviewed policy.
- Rate-limit public endpoints and validate geometry/query bounds.

The API applies a validated per-process/IP request budget to non-health routes, supports an explicit multi-origin CORS allowlist, and emits structured Fastify/Pino logs at the configured level. Liveness does not touch dependencies; readiness executes a store probe. Event polling is capped at 100 items per response. A distributed limiter is required before horizontally scaled deployment.

## Testing

- Unit tests for thresholds, score normalization, and policy.
- Contract tests for adapters and API schemas.
- Integration tests from state snapshot through persisted decision.
- PostgreSQL 17 CI integration verifies ordered migration application, tracking, checksums, repeat execution, and retention-index presence.
- Playwright browser tests for authoritative catalog loading, trail selection, recommendation rendering, responsive stacking, stale-weather warnings, and absence of simulation controls.
- Golden scenarios for stable route-policy outcomes.
- Pull-request CI installs from `package-lock.json`, then runs the complete test, type-check, and production-build commands on Node.js 22.

## Release Boundaries

The supported topology is one API replica. Evaluation remains synchronous and bounded by provider timeouts; reviewed geometry remains versioned source while selected internet geometry is copied into the session record; sessions are anonymous capability URLs; and client updates use cursor polling. A queue, distributed scheduler/rate limiter, end-user accounts, PostGIS, locally hosted spatial search, and streaming transport are new designs required only before adding horizontal scale, personal data, a persistent trail catalog, or real-time push. The deterministic baseline is a versioned prototype policy and must not be represented as safety-calibrated. Initial service objectives and operator alerts are defined in `deployment.md`.

## Production Packaging

The API and web workspaces build independently into pinned Node 22.23.3/Alpine 3.24 and Nginx 1.30.5/Alpine 3.24 images. Compose gates the API on a successful tracked migration and gates Nginx on API readiness. Browser requests use same-origin `/api/v1`; the controlled Nginx hop enables `TRUST_PROXY=true`, while direct deployments default it off. CI validates the topology and builds both images on every pull request.

## Implemented OpenRouter Adapter

The API owns the OpenRouter credential and calls the configurable chat-completions endpoint with a 30-second timeout. `OPENROUTER_MODEL` defaults to `openrouter/auto` and may be pinned to any compatible OpenRouter model ID. The request uses a bounded system prompt, temperature zero, minimal excluded reasoning, a 3,000-token completion budget, provider parameter enforcement, and strict JSON Schema requiring every supplied candidate route exactly once with a suitability number in `[0, 1]`. Zod and route-set validation reject malformed, duplicate, missing, or unknown results. New evaluations record provider provenance as `openrouter` or `deterministic-baseline`; the shared reader also accepts legacy `jev` records created before DEC-043. Network, timeout, HTTP, JSON, or validation failures do not block session startup; they degrade visibly to the baseline. Recommendation policy remains separate and is not implemented by this adapter.

## Implemented Recommendation Policy

`selectRouteRecommendation` is pure application policy. It validates route membership, removes hard-excluded routes, and selects the greatest remaining suitability with stable route-order ties. New results record `hard-constraints-v2`, audited exclusions, and a decision timestamp; when no route remains, the result is explicitly unavailable. OpenRouter and the deterministic baseline only supply scores; neither controls the final route directly.

## Deterministic Explanation and Camera Behavior

The recommendation policy creates explanation copy only from validated route metrics and the same hiking-state snapshot used for evaluation. It does not generate hidden reasoning or call an LLM. The client renders those facts directly. When a preview or recommendation first arrives, Cesium estimates the visible terrain height for its coordinates, builds the bounding sphere above the surface, and uses a minimum safe oblique range. This prevents depth-tested terrain from hiding a sea-level camera target. `prefers-reduced-motion` changes the transition duration to zero.

After a recommendation is available, TerrainMap samples its line geometry by cumulative segment distance and advances a directional billboard over it during a 16-second browser animation. A pulsing halo and luminous completed polyline preserve visibility over terrain, while an accessible progressbar and pause, resume, play-again, and restart controls mirror animation state. Four synchronized replay stages expose validated provider scores, the model-score leader, deterministic eligibility policy, and the confirmed recommendation; the persistent full-response action expands, scrolls to, and focuses the complete scored-route panel. That panel renders the shared hiking-state snapshot, every provider score, policy version, eligibility count, exclusion reasons, deterministic factors, and final explanation. It explicitly states that private chain-of-thought is neither requested nor displayed. Collapsing the playback instrument hides its detailed replay and controls while retaining its status, percentage, compact progress line, Cesium entities, animation clock, and current progress. Route or viewer changes cancel the active animation frame and remove its Cesium entities. Reduced-motion users receive a non-animated control that can reveal the endpoint immediately. The surface is labeled `Animated guide · not live GPS`; no playback value is persisted or used by recommendation policy. Cesium native rotate, translate, zoom, tilt, and look inputs remain explicitly enabled, with visible zoom in/out, screen-relative directional pan, and route-frame buttons as keyboard alternatives.

## Implemented Decision Events

A session publishes `session_started` after the initial decision and `recommendation_updated` only after a current-sequence threshold evaluation succeeds. Event sequence is contiguous and independent of state-update sequence. `GET /sessions/{sessionId}/events` performs cursor filtering and returns the last delivered sequence as `nextCursor`. The client validates every batch and uses recursive five-second polling so requests do not overlap. Failed reads mark the feed as retrying without discarding the last valid decision.

## Implemented Adapter Authentication

`resolveAdapterAuthConfig` trims and validates `STATE_ADAPTER_TOKEN` during application construction. Configured credentials shorter than 32 characters are rejected, and production construction fails without a token. The state-update route validates the bearer scheme and performs a length check followed by Node's constant-time `timingSafeEqual` comparison before accessing session state. Local development remains credential-optional; end-user authentication is not part of this boundary.

## Implemented Weather Adapter

`OpenMeteoWeatherProvider` accepts only HTTPS remote endpoints (with HTTP allowed for localhost tests), adds supported-hike coordinates and explicit Fahrenheit/mph/UTC query parameters, and aborts after four seconds. Zod validates the provider payload before normalization. Precipitation percentage becomes a 0-1 probability; UTC sunset becomes a non-negative remaining-minute value. The session preserves provider, license, attribution URL, observation time, receipt time, and typed environmental status in the shared contract. The HUD renders provider credit plus current, stale/failure, or prototype state.

Weather is opt-in outside production and required in production through `WEATHER_API_BASE_URL`; `WEATHER_API_KEY` is forwarded only when configured for a paid endpoint. Development/test missing configuration or provider failure uses the explicit prototype-static snapshot. Production missing configuration fails startup, while fetch, status, timeout, timestamp, or schema failure returns `503 weather_unavailable` so fabricated conditions cannot drive a production recommendation.

## Authoritative Route Catalog

The checked-in Wachusett catalog contains the DCR Pine Hill, Mountain House, and Harrington summit corridors. `scripts/import-dcr-trails.mjs` requests explicit feature IDs from the public DCR ArcGIS layer, validates that every segment is present and marked legal, rejects gaps over 20 meters, converts coordinates to WGS84 triples, and regenerates the immutable TypeScript snapshot. API startup parses the snapshot through the shared route schema. Source URL, dataset timestamp, feature IDs, legal status, and recorded condition remain attached to every route.

The DCR line layer has no elevation coordinates or exposure rating. Generated coordinates therefore carry zero as an explicit unavailable elevation value for Cesium ground clamping; official trail-map distance, elevation change, and duration populate route metrics. Exposure is `unknown` and receives the conservative deterministic baseline value rather than an inferred favorable value. This snapshot does not replace current posted closure checks.

## Hard-Constraint Policy

Every route carries `legalStatus`, `accessStatus`, and typed restrictions. `selectRouteRecommendation` first builds audited exclusion reasons, then ranks only eligible routes. Illegal, closed, restricted, and `prohibitive` restriction records are hard exclusions; `advisory` records do not block ranking. If no score belongs to an eligible route, the policy returns `status: unavailable` rather than a route ID.

The recommendation schema accepts stored v1 decisions by defaulting them to `status: recommended` with an empty exclusion list. New decisions use `hard-constraints-v2`. An unknown access status is displayed and is not interpreted as open; the UI continues to direct users to current official notices.

## End-Session Lifecycle

Session is a discriminated union: active sessions have status active; ended sessions have status ended plus endedAt. Ending uses the existing session sequence as an optimistic concurrency boundary and writes the payload and relational status together. Repeated end requests are idempotent. Ended sessions remain readable until retention removes them, but state adapters and scheduled weather refresh cannot advance them.

## Internet Trail Search Design

Internet discovery uses a TrailSearchProvider boundary with OpenStreetMap Nominatim geocoding and bounded OSM map extracts. Only form submissions issue requests; autocomplete is intentionally absent. A per-process promise queue and next-request timestamp serialize uncached searches above the public service's one-request-per-second minimum interval, while a bounded 15-minute in-memory cache suppresses duplicates. Provider payloads are untrusted and Zod-validated. Direct line matches are returned immediately. A point or polygon match becomes the center of a small map window; private, sidewalk, and crossing ways are excluded, trail-like ways are ranked by tags, surface, distance, and length, and a clearly named nearby network is returned first. Dense-area 400 responses retry once with a smaller window. Selection remains presentation-only until the user explicitly starts a session. At start, `createInternetHike` turns a LineString into one candidate or a MultiLineString into separately named branches, calculates mapped length and a conservative time estimate, preserves source attribution, and marks access, legality, condition, exposure, and elevation as unknown. The exact generated `HikeDetail` is stored with the session and returned to the browser so evaluation scores, map highlighting, later reads, and reevaluations share one route set.

## Typography Readability

The field-instrument visual language uses weight, letter spacing, borders, and color for hierarchy rather than extremely small text. CSS raises the former 7-12 px metadata scale to 11-16 px, increases body copy, and enlarges Cesium route labels. Responsive layouts preserve these sizes and accept additional vertical space.

## Keyless Elevation Terrain

TerrainMap constructs one Cesium Terrain wrapper around either ArcGISTiledElevationTerrainProvider.fromUrl for the public global default or Terrain.fromWorldTerrain when an ion token exists. Ready/error events drive explicit map status. Lighting and depth testing activate only after provider readiness. Every route polyline clamps to ground; endpoint labels and points use CLAMP_TO_GROUND. The Cesium credit container remains visible because attribution is a data-source requirement.
