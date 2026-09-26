# API Specification

## Conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Identifiers: opaque strings.
- Timestamps: UTC ISO 8601.
- Coordinates: GeoJSON longitude/latitude order.
- Error body: `{ "error": { "code": "...", "message": "...", "details": {} } }`

## Endpoints

### GET /trails/search?q={query}

Runs a submitted-query internet search through the server-side OpenStreetMap Nominatim adapter. Queries must contain 2-120 characters. Response 200 contains the normalized query, OpenStreetMap attribution/link, and up to eight named line-mapped results with ID, name, location, mapped distance, LineString or MultiLineString geometry, source, and source URL.

The endpoint does not autocomplete. The adapter serializes uncached public-service requests to no more than one per second, caches duplicate queries for 15 minutes, and sends an identifying application user agent. Invalid queries return 422 invalid_trail_query; upstream timeout, HTTP, or schema failures return 502 trail_search_unavailable. Internet results are map previews and are not eligible for evaluated field sessions until a reviewed alternative-route dataset exists.
### `GET /hikes`

Lists supported predefined hikes.

Response `200`: `{ "items": [{ "id": "hike_1", "name": "...", "difficulty": "moderate", "bounds": {} }] }`

### `GET /hikes/{hikeId}`

Returns hike metadata and two or more typed route alternatives. Each route is a GeoJSON-compatible `Feature<LineString>` whose coordinates use `[longitude, latitude, elevationMeters]`.

Response `200` includes `routes[].properties` with identity, metrics, exposure, data quality, source URL, dataset timestamp, DCR segment IDs, recorded condition, legal status, access status, typed restrictions, and elevation source. Unknown IDs return a structured `404` with code `hike_not_found`.

### `POST /sessions`

Request: `{ "hikeId": "wachusett-summit", "selectedRouteId": "mountain-house-summit" }`

Response `201` is `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. A recommendation is either `status: "recommended"` with a route, suitability, and audited exclusions, or `status: "unavailable"` with exclusion reasons and no route ID. The session contains its ID, selected route, status, timestamps, and typed hiking-state snapshot. Live provider snapshots include both provider `observedAt` and server `receivedAt` timestamps. When `WEATHER_API_BASE_URL` is configured, the API requests and validates current Open-Meteo temperature, wind, precipitation probability, day/night status, and sunset data and returns `source: "weather"` with provider/license attribution. Outside production, timeout, transport, HTTP, or validation failure falls back to `source: "prototype-static"`, which must not be presented as live observed data. Production startup requires weather configuration, and a runtime provider failure returns `503 weather_unavailable`.

### `GET /sessions/{sessionId}`

Returns `{ "session": Session, "hike": HikeDetail, "decision": LatestDecision, "sequence": 0 }` from the configured session store. Unknown IDs return `404 session_not_found`.

### POST /sessions/{sessionId}/end

Ends an active field session and returns a Session response object. The returned session has status ended and an endedAt UTC timestamp. The operation is idempotent: repeating it returns the original ended session without changing endedAt. Unknown IDs return 404 session_not_found; a concurrent write returns 409 session_update_conflict.

Ended sessions are retained under the normal retention policy but no longer receive adapter state updates or automatic weather refreshes. State updates after ending return 409 session_ended.
### `PATCH /sessions/{sessionId}/state`

Accepts normalized updates from supported adapter source types or explicit user-entered facts. This endpoint does not support simulated-condition actions.

When `STATE_ADAPTER_TOKEN` is configured, callers must send `Authorization: Bearer <token>`. Missing or invalid credentials return `401 adapter_unauthorized` with a `WWW-Authenticate` challenge before session lookup or request validation. The token must contain at least 32 characters. Local development may omit it; API startup fails when `NODE_ENV=production` and the token is absent.

Request: `{ "observedAt": "...", "source": "weather", "changes": { "windMph": 18 } }`

Supported sources are `weather`, `user-input`, and `system-time`. Supported changes are `temperatureF`, `windMph`, `rainProbability`, `remainingMinutes`, `paceMph`, and `fatigue`; at least one is required.

Response `202`: `{ "accepted": true, "evaluationQueued": false, "reason": "no_relevant_threshold_crossed", "sequence": 1, "crossedThresholds": [] }`

The detector compares the accumulated current state with the last evaluated snapshot. It triggers at temperature change >= 10 F, wind change >= 5 mph, rain-probability change >= 0.15, remaining-daylight change >= 10 minutes, relative pace change >= 15%, or any fatigue change. A triggering response sets `evaluationQueued: true`, lists the crossed fields, and includes `decision` when that request remains the newest sequence. Evaluation completes synchronously inside the request. `evaluationQueued` is retained for response compatibility and means that a threshold evaluation was requested; a current-sequence response also carries the completed `decision`.

Unknown sessions return `404 session_not_found`, invalid updates return `422 invalid_state_update`, observations not newer than the current snapshot return `409 stale_state_update`, and a concurrent compare-and-swap failure returns `409 state_update_conflict`. The endpoint is protected by the configured adapter bearer credential. This shared-secret boundary authenticates adapters, not end users; rotate and distribute it through deployment secret management.

### Evaluation execution boundary

There is no callable evaluation endpoint in this release. Initial and threshold-crossing evaluations are internal application operations, so users cannot manually trigger or simulate them. A future asynchronous worker would require a separately reviewed contract rather than an undocumented route.

### `GET /sessions/{sessionId}/evaluations/latest`

Returns the typed route evaluation and deterministic recommendation, including its concise explanation, display factors, hard-constraint exclusions, policy version, and explicit unavailable outcome when every route is ineligible.

### `GET /sessions/{sessionId}/events?after={cursor}`

Returns `{ "items": DecisionEvent[], "nextCursor": 2, "state": HikingState, "environmentalStatus": EnvironmentalStatus }`. Omitting `after` reads from the start; otherwise only events with a greater event sequence are returned. Event sequence is independent from accepted state-update sequence, starts at one, and advances only when a decision is published.

Each event includes its ID, session ID, type (`session_started` or `recommendation_updated`), occurrence time, exact hiking-state snapshot, typed decision, and crossed thresholds. Invalid cursors return `422 invalid_cursor` and unknown sessions return `404 session_not_found`. The feed is durable when PostgreSQL is configured and process-local in the development/test fallback. Every read also returns the latest state and environmental status, even when no new decision event exists, so below-threshold observations and refresh failures reach the HUD without creating false recommendation events. The client polls every five seconds. Streaming transport is outside the release boundary.

## Status Codes

Use `400` invalid input, `401` missing or invalid credentials, `404` unknown resource, `409` stale/conflicting state, `422` valid JSON with unusable domain data, `429` rate limited, and `5xx` service/integration failure.

## Release API Boundary

The release exposes only the endpoints documented above. Sessions are anonymous capability URLs and contain no account profile or live GPS history. End-user accounts, streaming transport, and a manually callable evaluation endpoint are outside the MVP; adding any of them requires a new security/privacy and API review. Decision-event polling accepts `after` and an optional `limit` from 1 to 100; the configured default is 50.

## Implemented Route Evaluation Contract

`POST /sessions` runs the initial route evaluation, applies deterministic policy, and returns `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. `RouteEvaluation` includes an ID, session ID, timestamp, `questionSetVersion`, provider provenance, and one `{ routeId, suitability }` score per route. Suitability is bounded from `0` to `1`.

`GET /sessions/{sessionId}/evaluations/latest` returns `{ "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }` or a structured `404` with code `evaluation_not_found`. The current store is PostgreSQL-backed when `DATABASE_URL` is configured, with an in-memory development/test fallback.

When `OPENROUTER_API_KEY` is configured, the server sends the shared hiking state and reviewed route metadata to the OpenRouter chat-completions endpoint. The request requires strict JSON-schema output containing each route exactly once with a suitability value in `[0, 1]`; unknown, duplicate, missing, or out-of-range scores are rejected. Missing credentials, timeout, transport errors, non-success responses, or invalid model output use the explicitly labeled `deterministic-baseline` provider. The fallback is development continuity, not a claim of model inference.

## Recommendation Explanation Fields

`RouteRecommendation.explanation` is a concise deterministic summary derived from the selected route and the evaluated state snapshot. `factors` contains two or three display-ready `{ label, value }` facts. The current policy emits daylight margin, exposure, and elevation gain. These fields describe the score inputs and do not claim that a route is safe.

## Automatic Weather Refresh

When live weather is configured, the API process scans active sessions at `WEATHER_REFRESH_INTERVAL_MS` (five minutes by default). It fetches one snapshot per supported hike per cycle, rejects duplicate or older provider observations, preserves user pace/fatigue, and applies the same cumulative thresholds and compare-and-swap persistence used by `PATCH /sessions/{sessionId}/state`. Threshold-crossing refreshes append `recommendation_updated` events; below-threshold refreshes update current state without publishing a decision. Provider failures retain the last valid state and decision, atomically mark environmental status `stale/refresh_failed`, and are logged without creating fabricated updates. Successful observations are `current` until `staleAfter`; expired reads resolve to `stale/observation_expired`. Static development data is always `prototype/prototype_static`.

### Operational endpoints

- `GET /api/v1/health` — backward-compatible liveness response.
- `GET /api/v1/health/live` — process liveness; excluded from rate limiting.
- `GET /api/v1/health/ready` — dependency readiness; verifies the configured session store and returns `503` when unavailable.

All non-health endpoints share a per-process, per-client-IP request limit. Exceeded requests return `429` with standard rate-limit headers.
