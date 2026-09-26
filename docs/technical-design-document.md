# Technical Design Document

## Session Flow

1. Client requests supported hikes and selects one.
2. API loads trail geometry, terrain references, and candidate routes.
3. At session start, the question service loads a deterministic approved Jev question set. If the optional LLM integration is enabled, it may select a bounded subset; unavailable or invalid LLM output falls back to the approved default set.
4. The state service requests and validates configured live weather/daylight, or produces a visibly labeled static fallback when the provider is absent or unavailable.
5. Jev evaluates each candidate route using the same snapshot and questions.
6. Policy rejects hard-constraint violations, ranks remaining routes, and selects one.
7. API persists the evaluation and emits a decision event.
8. Client updates route styling, cards, HUD, and feed.

## Re-Evaluation

`PATCH /api/v1/sessions/{sessionId}/state` validates supported source-specific changes and rejects observations whose timestamp is not newer than the session's current state. The detector compares the accumulated state with the last evaluated snapshot, not merely the preceding update. Thresholds are 10 F temperature, 5 mph wind, 0.15 rain probability, 10 minutes remaining daylight, 15% relative pace, and any fatigue-level change.

Every accepted update, including an automatic weather refresh, increments a session-scoped sequence. With live weather configured, a serialized background refresher lists durable active sessions every five minutes by default, deduplicates provider reads per hike, rejects duplicate/older observations, and preserves user state while replacing environmental fields. Provider failures retain the last valid state and decision. A threshold crossing runs evaluation synchronously in the current process. The complete state/decision/event transition is then saved with an expected prior sequence; PostgreSQL applies that comparison and the event writes in one transaction. A mismatch returns `409 state_update_conflict`, so an older concurrent request cannot overwrite newer state. A future worker can preserve the same contract while making evaluation asynchronous. This process is automatic and has no user-facing evaluation control.

## Reliability

- Validate all external data at adapter boundaries.
- Make evaluation writes idempotent with a request key.
- Time out external Jev and LLM calls explicitly.
- Retain the last valid recommendation when a refresh fails, atomically mark environmental status stale, and expose that state on every event-feed poll. Expire otherwise successful Open-Meteo observations after the configured 30-minute default ceiling.
- Never silently convert missing safety-relevant input into a favorable score.

## Security and Privacy

- Keep secrets server-side.
- Minimize stored location and user-state data.
- Define retention and deletion policy before collecting personal GPS history.
- Rate-limit public endpoints and validate geometry/query bounds.

## Testing

- Unit tests for thresholds, score normalization, and policy.
- Contract tests for adapters and API schemas.
- Integration tests from state snapshot through persisted decision.
- Browser tests for trail selection and recommendation rendering.
- Golden scenarios for stable route-policy outcomes.
- Pull-request CI installs from `package-lock.json`, then runs the complete test, type-check, and production-build commands on Node.js 22.

## TBD

Queue mechanism, cache strategy, end-user authentication, PostGIS route persistence, calibrated scoring policy, retention, and operational SLOs.

## Implemented Jev Adapter

The API owns Jev credentials and calls the configured decision endpoint with a four-second timeout. Each route maps to one Noul question, and the response must provide a probability in `[0, 1]` for every returned answer. The application contract records provider provenance as `jev` or `deterministic-baseline`. Network or validation failures do not block session startup; they degrade visibly to the baseline. Recommendation policy remains separate and is not implemented by this adapter.

## Implemented Recommendation Policy

`selectRouteRecommendation` is pure application policy. It indexes scores by route ID, considers only routes in the validated hike, and selects the greatest suitability. Exact ties retain the hike's stable route order. The result records `highest-suitability-v1`, the winning score, and a decision timestamp. Jev and the deterministic baseline only supply scores; neither controls the final route directly.

## Deterministic Explanation and Camera Behavior

The recommendation policy creates explanation copy only from validated route metrics and the same hiking-state snapshot used for evaluation. It does not generate hidden reasoning or call an LLM. The client renders those facts directly. When the recommendation first arrives, Cesium computes a bounding sphere from that route's coordinates and flies to it once; `prefers-reduced-motion` changes the transition duration to zero.

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
