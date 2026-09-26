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

Response `201` is `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. The session contains its ID, selected route, status, timestamps, and typed hiking-state snapshot. The current implementation returns `source: "prototype-static"`; it must not be presented as live observed data.

### `GET /sessions/{sessionId}`

Returns `{ "session": Session, "hike": HikeDetail, "decision": LatestDecision, "sequence": 0 }` from the current process-memory read model. Unknown IDs return `404 session_not_found`.

### `PATCH /sessions/{sessionId}/state`

Accepts normalized updates from supported adapter source types or explicit user-entered facts. Authentication is not implemented yet, so production callers are not authorized by the current prototype. This endpoint does not support simulated-condition actions.

Request: `{ "observedAt": "...", "source": "weather", "changes": { "windMph": 18 } }`

Supported sources are `weather`, `user-input`, and `system-time`. Supported changes are `temperatureF`, `windMph`, `rainProbability`, `remainingMinutes`, `paceMph`, and `fatigue`; at least one is required.

Response `202`: `{ "accepted": true, "evaluationQueued": false, "reason": "no_relevant_threshold_crossed", "sequence": 1, "crossedThresholds": [] }`

The detector compares the accumulated current state with the last evaluated snapshot. It triggers at temperature change >= 10 F, wind change >= 5 mph, rain-probability change >= 0.15, remaining-daylight change >= 10 minutes, relative pace change >= 15%, or any fatigue change. A triggering response sets `evaluationQueued: true`, lists the crossed fields, and includes `decision` when that request remains the newest sequence. Evaluation currently completes synchronously inside the request; the field name preserves the future queued-worker contract.

Unknown sessions return `404 session_not_found`, invalid updates return `422 invalid_state_update`, and observations not newer than the current snapshot return `409 stale_state_update`. The endpoint currently has no authentication and must not be exposed as a trusted production adapter boundary until authentication is implemented.

### Planned: `POST /sessions/{sessionId}/evaluations`

A future internal service endpoint will run or queue an evaluation from durable current state. The prototype instead calls `evaluateRoutes` in process at session creation and after a relevant threshold crossing. No path is connected to a user-facing evaluation button. The future request will support an idempotency key header and return `202` with `evaluationId` and `status`.

### `GET /sessions/{sessionId}/evaluations/latest`

Returns the typed route evaluation and deterministic recommendation, including its concise explanation and display factors. Constraint details will be added when those inputs are implemented.

### `GET /sessions/{sessionId}/events?after={cursor}`

Returns ordered decision-feed events. Streaming transport may be added later; TBD.

## Status Codes

Use `400` invalid input, `404` unknown resource, `409` stale/conflicting state, `422` valid JSON with unusable domain data, `429` rate limited, and `5xx` service/integration failure.

## Pending Contracts

Schemas for the internal evaluation and events endpoints, authentication, pagination limits, and real-time transport are TBD.

## Implemented Route Evaluation Contract

`POST /sessions` runs the initial route evaluation, applies deterministic policy, and returns `{ "session": Session, "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }`. `RouteEvaluation` includes an ID, session ID, timestamp, `questionSetVersion`, provider provenance, and one `{ routeId, suitability }` score per route. Suitability is bounded from `0` to `1`.

`GET /sessions/{sessionId}/evaluations/latest` returns `{ "evaluation": RouteEvaluation, "recommendation": RouteRecommendation }` or a structured `404` with code `evaluation_not_found`. The current store is process memory and is replaced by persistence in a later stage.

When `JEV_API_KEY` is configured, the server sends the shared hiking state and one typed Noul suitability question per valid route to the Jev endpoint. Missing credentials, timeout, transport errors, or invalid Jev responses use the explicitly labeled `deterministic-baseline` provider. The fallback is development continuity, not a claim of Jev inference.

## Recommendation Explanation Fields

`RouteRecommendation.explanation` is a concise deterministic summary derived from the selected route and the evaluated state snapshot. `factors` contains two or three display-ready `{ label, value }` facts. The current policy emits daylight margin, exposure, and elevation gain. These fields describe the score inputs and do not claim that a route is safe.
