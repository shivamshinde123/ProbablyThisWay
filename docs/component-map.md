# Component Map

## Browser

| Component | Responsibility | Depends on |
|---|---|---|
| `App.tsx` | Load the supported catalog, start one session, poll events, and compose the screen | Shared contracts and HTTP API |
| TrailSearch.tsx | Submit worldwide trail/place searches, combine reviewed matches with attributed internet results, and select preview geometry | Typed hike detail and trail-search API |
| TerrainMap.tsx | Own Cesium lifecycle, keyless ArcGIS or token-based elevation terrain, vertical exaggeration, clamped route entities/labels, credits, and explicit oblique camera framing | Cesium and typed routes |
| `SessionHud.tsx` | Show current weather/daylight/user state, source attribution, and freshness | Session state |
| `RecommendationBanner.tsx` | Show recommendation or no-route outcome, evidence, and safety copy | Typed policy result |
| `DecisionFeed.tsx` | Show recent ordered decision events and polling state | Events response |

## API

| Component | Responsibility | Depends on |
|---|---|---|
| `server.ts` | Resolve runtime configuration and listen | `app.ts` |
| `app.ts` | Compose Fastify, public/read routes, protected adapter mutation, health, CORS, logging, and rate limits | Catalog, stores, adapters, shared contracts |
| `route-catalog.ts` | Parse and expose the immutable reviewed DCR route snapshot | Generated snapshot and shared schemas |
| `weather-adapter.ts` | Fetch, validate, normalize, and attribute Open-Meteo observations | HTTPS provider |
| `weather-refresh.ts` | Serialize periodic active-session refreshes and deduplicate reads per hike | Weather adapter and `SessionStore` |
| `session-state.ts` | Merge ordered observations, detect thresholds, evaluate, apply policy, and persist compare-and-swap transitions | Store, evaluator, policy |
| `evaluation.ts` | Invoke OpenRouter with a strict route-score schema when configured or return the labeled deterministic baseline | Hiking state and candidate routes |
| `policy.ts` | Hard-exclude ineligible routes and deterministically rank the rest | Typed evaluation and route metadata |
| `environmental-status.ts` | Derive current, stale, failed, or prototype state | Observation times and freshness config |
| `session-store.ts` | Persist sessions, decisions, cursors, events, readiness, and retention | PostgreSQL or in-memory development adapter |
| `migration-runner.ts` | Apply ordered immutable migrations under an advisory lock | PostgreSQL |
| `retention.ts` | Schedule bounded deletion of inactive sessions | `SessionStore` |
| `adapter-auth.ts` | Validate and compare the server-to-server bearer credential | Node crypto |
| `operational-config.ts` | Validate CORS, logging, proxy, rate, and pagination settings | Environment and Zod |

## Shared and Operational

| Component | Responsibility | Depends on |
|---|---|---|
| `packages/contracts` | Define every public request, response, state, route, evaluation, and event schema | Zod |
| `scripts/import-dcr-trails.mjs` | Regenerate authoritative WGS84 route geometry from reviewed DCR feature IDs | Massachusetts DCR ArcGIS endpoint |
| PostgreSQL migrations | Create session/event storage, migration history, and retention indexes | PostgreSQL 17 |
| API/web Dockerfiles | Produce unprivileged API and Nginx web images | Locked workspaces |
| `compose.yaml` | Gate migrations, API readiness, and web startup | PostgreSQL and built images |
| GitHub Actions | Run quality, tests, PostgreSQL integration, builds, container smoke, and browser flows | Ubuntu runner |

## Dependency Rule

The browser depends on shared contracts and public API responses. Provider and database details stay inside API adapters. Pure policy and threshold functions do not depend on React, Cesium, Fastify, PostgreSQL, or provider SDKs.

## Session Lifecycle Additions

- App owns start/end request state. While a session is active it replaces the start control with a visible End field session action. Trail discovery remains available during the session; internet previews remain ineligible for session start. A successful end clears live-session presentation.
- POST /api/v1/sessions/:sessionId/end performs the lifecycle transition through SessionStore compare-and-swap persistence.
- SessionStore persists both the typed JSON session and relational lifecycle status. WeatherRefresher queries only active session IDs and rechecks status after loading.

## Internet Trail Discovery Components

- NominatimTrailSearchProvider serializes searches, enforces a delay above the public one-request-per-second ceiling, caches duplicate queries for 15 minutes, validates provider payloads, returns direct trail-like lines, and resolves point/area matches to a bounded nearby OpenStreetMap path extract.
- GET /api/v1/trails/search validates submitted queries and isolates provider failures behind a structured 502 response.
- TerrainMap renders selected internet LineString or MultiLineString geometry as an orange preview and frames it with the camera.
