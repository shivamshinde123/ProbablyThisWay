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

Request: `{ "hikeId": "hike_1", "userProfile": { "experience": "intermediate" } }`

Response `201`: `{ "id": "session_1", "hikeId": "hike_1", "status": "active", "state": {}, "routes": [] }`

### `GET /sessions/{sessionId}`

Returns the current state, candidate routes, latest recommendation, and decision-feed cursor.

### `PATCH /sessions/{sessionId}/state`

Accepts state updates only from authorized live-input adapters or explicit user-entered facts. This endpoint does not support simulated-condition actions.

Request: `{ "observedAt": "...", "source": "weather", "changes": { "windMph": 18 } }`

Response `202`: `{ "accepted": true, "evaluationQueued": false, "reason": "no_relevant_threshold_crossed" }`

`evaluationQueued` is `true` only when the normalized update crosses a configured evaluation threshold. Otherwise it is `false`, with a machine-readable `reason`.

### `POST /sessions/{sessionId}/evaluations`

Internal service endpoint that runs or queues an evaluation from the current persisted state. It is invoked at session creation or after a relevant threshold crossing and is not connected to a user-facing evaluation button. Request supports an idempotency key header. Response `202` includes `evaluationId` and `status`.

### `GET /sessions/{sessionId}/evaluations/latest`

Returns inputs, questions, per-route suitability, constraints, selected route, explanation, and evaluation timestamp.

### `GET /sessions/{sessionId}/events?after={cursor}`

Returns ordered decision-feed events. Streaming transport may be added later; TBD.

## Status Codes

Use `400` invalid input, `404` unknown resource, `409` stale/conflicting state, `422` valid JSON with unusable domain data, `429` rate limited, and `5xx` service/integration failure.

## Pending Contracts

Exact JSON Schemas, authentication method, pagination limits, and real-time transport are TBD.
