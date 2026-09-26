# API Specification

## Conventions

- Base path: `/api/v1`
- Media type: `application/json`
- Identifiers: opaque strings.
- Timestamps: UTC ISO 8601.
- Coordinates: GeoJSON longitude/latitude order.
- Error body: `{ "error": { "code": "...", "message": "...", "details": {} } }`

## Endpoints

### `GET /hikes`

Lists supported predefined hikes.

Response `200`: `{ "items": [{ "id": "hike_1", "name": "...", "difficulty": "moderate", "bounds": {} }] }`

### `GET /hikes/{hikeId}`

Returns hike metadata and two or more typed route alternatives. Each route is a GeoJSON-compatible `Feature<LineString>` whose coordinates use `[longitude, latitude, elevationMeters]`.

Response `200` includes `routes[].properties` with `id`, `name`, `source`, `dataQuality`, `distanceMiles`, `elevationGainFeet`, `estimatedMinutes`, and `exposure`. Unknown IDs return a structured `404` with code `hike_not_found`.

### `POST /sessions`

Request: `{ "hikeId": "wachusett-summit", "selectedRouteId": "balanced-traverse" }`

Response `201` is `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. The session contains its ID, selected route, status, timestamps, and typed hiking-state snapshot. Live provider snapshots include both provider `observedAt` and server `receivedAt` timestamps. When `WEATHER_API_BASE_URL` is configured, the API requests and validates current Open-Meteo temperature, wind, precipitation probability, day/night status, and sunset data and returns `source: "weather"` with provider/license attribution. Outside production, timeout, transport, HTTP, or validation failure falls back to `source: "prototype-static"`, which must not be presented as live observed data. Production startup requires weather configuration, and a runtime provider failure returns `503 weather_unavailable`.

### `GET /sessions/{sessionId}`

Returns `{ "session": Session, "hike": HikeDetail, "decision": LatestDecision, "sequence": 0 }` from the configured session store. Unknown IDs return `404 session_not_found`.

### `PATCH /sessions/{sessionId}/state`

Accepts normalized updates from supported adapter source types or explicit user-entered facts. This endpoint does not support simulated-condition actions.

When `STATE_ADAPTER_TOKEN` is configured, callers must send `Authorization: Bearer <token>`. Missing or invalid credentials return `401 adapter_unauthorized` with a `WWW-Authenticate` challenge before session lookup or request validation. The token must contain at least 32 characters. Local development may omit it; API startup fails when `NODE_ENV=production` and the token is absent.

Request: `{ "observedAt": "...", "source": "weather", "changes": { "windMph": 18 } }`

Supported sources are `weather`, `user-input`, and `system-time`. Supported changes are `temperatureF`, `windMph`, `rainProbability`, `remainingMinutes`, `paceMph`, and `fatigue`; at least one is required.

Response `202`: `{ "accepted": true, "evaluationQueued": false, "reason": "no_relevant_threshold_crossed", "sequence": 1, "crossedThresholds": [] }`

The detector compares the accumulated current state with the last evaluated snapshot. It triggers at temperature change >= 10 F, wind change >= 5 mph, rain-probability change >= 0.15, remaining-daylight change >= 10 minutes, relative pace change >= 15%, or any fatigue change. A triggering response sets `evaluationQueued: true`, lists the crossed fields, and includes `decision` when that request remains the newest sequence. Evaluation currently completes synchronously inside the request; the field name preserves the future queued-worker contract.

Unknown sessions return `404 session_not_found`, invalid updates return `422 invalid_state_update`, observations not newer than the current snapshot return `409 stale_state_update`, and a concurrent compare-and-swap failure returns `409 state_update_conflict`. The endpoint is protected by the configured adapter bearer credential. This shared-secret boundary authenticates adapters, not end users; rotate and distribute it through deployment secret management.

### Planned: `POST /sessions/{sessionId}/evaluations`

A future internal service endpoint will run or queue an evaluation from durable current state. The prototype instead calls `evaluateRoutes` in process at session creation and after a relevant threshold crossing. No path is connected to a user-facing evaluation button. The future request will support an idempotency key header and return `202` with `evaluationId` and `status`.

### `GET /sessions/{sessionId}/evaluations/latest`

Returns the typed route evaluation and deterministic recommendation, including its concise explanation and display factors. Constraint details will be added when those inputs are implemented.

### `GET /sessions/{sessionId}/events?after={cursor}`

Returns `{ "items": DecisionEvent[], "nextCursor": 2, "state": HikingState, "environmentalStatus": EnvironmentalStatus }`. Omitting `after` reads from the start; otherwise only events with a greater event sequence are returned. Event sequence is independent from accepted state-update sequence, starts at one, and advances only when a decision is published.

Each event includes its ID, session ID, type (`session_started` or `recommendation_updated`), occurrence time, exact hiking-state snapshot, typed decision, and crossed thresholds. Invalid cursors return `422 invalid_cursor` and unknown sessions return `404 session_not_found`. The feed is durable when PostgreSQL is configured and process-local in the development/test fallback. Every read also returns the latest state and environmental status, even when no new decision event exists, so below-threshold observations and refresh failures reach the HUD without creating false recommendation events. The client polls every five seconds; streaming transport remains a future option.

## Status Codes

Use `400` invalid input, `401` missing or invalid credentials, `404` unknown resource, `409` stale/conflicting state, `422` valid JSON with unusable domain data, `429` rate limited, and `5xx` service/integration failure.

## Pending Contracts

Schemas for the internal evaluation endpoint, end-user authentication, pagination limits, and real-time transport are TBD.

## Implemented Route Evaluation Contract

`POST /sessions` runs the initial route evaluation, applies deterministic policy, and returns `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. `RouteEvaluation` includes an ID, session ID, timestamp, `questionSetVersion`, provider provenance, and one `{ routeId, suitability }` score per route. Suitability is bounded from `0` to `1`.

`GET /sessions/{sessionId}/evaluations/latest` returns `{ "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }` or a structured `404` with code `evaluation_not_found`. The current store is PostgreSQL-backed when `DATABASE_URL` is configured, with an in-memory development/test fallback.

When `JEV_API_KEY` is configured, the server sends the shared hiking state and one typed Noul suitability question per valid route to the Jev endpoint. Missing credentials, timeout, transport errors, or invalid Jev responses use the explicitly labeled `deterministic-baseline` provider. The fallback is development continuity, not a claim of Jev inference.

## Recommendation Explanation Fields

`RouteRecommendation.explanation` is a concise deterministic summary derived from the selected route and the evaluated state snapshot. `factors` contains two or three display-ready `{ label, value }` facts. The current policy emits daylight margin, exposure, and elevation gain. These fields describe the score inputs and do not claim that a route is safe.

## Automatic Weather Refresh

When live weather is configured, the API process scans active sessions at `WEATHER_REFRESH_INTERVAL_MS` (five minutes by default). It fetches one snapshot per supported hike per cycle, rejects duplicate or older provider observations, preserves user pace/fatigue, and applies the same cumulative thresholds and compare-and-swap persistence used by `PATCH /sessions/{sessionId}/state`. Threshold-crossing refreshes append `recommendation_updated` events; below-threshold refreshes update current state without publishing a decision. Provider failures retain the last valid state and decision, atomically mark environmental status `stale/refresh_failed`, and are logged without creating fabricated updates. Successful observations are `current` until `staleAfter`; expired reads resolve to `stale/observation_expired`. Static development data is always `prototype/prototype_static`.
