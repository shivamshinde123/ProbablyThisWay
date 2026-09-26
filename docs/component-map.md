# Component Map

## Frontend Components

| Component | Responsibility | Depends on |
|---|---|---|
| `AppShell` | Layout and global error boundary | Session controller |
| `HikeSelector` | Choose a predefined hike | Hike API |
| `TerrainMap` | Own the Cesium viewer lifecycle, camera, terrain mode, route overlay, and cleanup | CesiumJS and terrain config |
| `TrailLayer` | Render primary trail | Trail GeoJSON |
| `RouteLayer` | Render alternatives and recommendation styles | Route/evaluation data |
| `MapLabels` | Route names and suitability labels | Route projections |
| `SessionHud` | Display the active session ID plus weather, daylight, pace, fatigue, source, and observation time | Typed session state |
| `RoutePanel` | Compare and select candidate routes by distance, gain, time, and exposure | Typed route features |
| `DecisionFeed` | Chronological evaluation events | Events API |
| `ExplanationPanel` | Human-readable rationale and safety copy | Latest evaluation |

## Backend Components

| Component | Responsibility | Depends on |
|---|---|---|
| Route catalog | Parses and exposes the reviewed DCR snapshot | Generated WGS84 geometry, DCR provenance, official trail-map metrics |
| Session service | Session lifecycle | Catalog, state store |
| State normalizer | Canonical hiking state | Input adapters |
| Threshold detector | Decide when to re-evaluate | State snapshots |
| Route service | Candidate geometry and metrics | GIS/PostGIS |
| Question service | Approved Jev question set | Catalog, optional LLM |
| Evaluation service | Evaluate every route | Jev adapter |
| Route policy | Exclude illegal, closed, restricted, or prohibitively constrained routes; rank eligible routes or return unavailable | Evaluation results and typed route access metadata |
| Event service | Persist/serve decision feed | Database |
| Explanation service | Optional concise rationale | Structured decision, optional LLM |

## Dependency Rule

UI and external adapters depend inward on application/domain interfaces. Domain policy must not depend on React, Cesium, HTTP, database drivers, Jev SDK details, or an LLM SDK.

## Implemented Evaluation Components

| Component | Responsibility | Depends on |
|---|---|---|
| `evaluation.ts` | Invoke Jev with typed route questions or produce the labeled deterministic baseline | Hiking state, valid route alternatives, server environment |
| `SessionStore` | Persist the current session, latest decision, sequences, and ordered events | PostgreSQL or in-memory adapter |
| Route score display | Render bounded suitability and provider provenance without selecting a recommendation | Typed route evaluation |

## Implemented Recommendation Components

| Component | Responsibility | Depends on |
|---|---|---|
| `policy.ts` | Select the highest-scoring valid route with deterministic tie-breaking | Typed evaluation and hike routes |
| `RecommendationBanner` | Show the chosen route, suitability, policy version, and judgment reminder | Typed recommendation |
| Recommendation-aware `TerrainMap` | Render recommended, originally selected, and alternative route states | Route IDs and recommendation score |

## Phase 7 Component Behavior

- `RecommendationBanner` renders the deterministic explanation and three evidence fields.
- `TerrainMap` frames a new recommendation once using its coordinate-derived bounding sphere and honors reduced-motion preferences.
- `App` exposes evaluation progress through `aria-busy` and a visible map status instrument.

## Implemented State Update Components

| Component | Responsibility | Depends on |
|---|---|---|
| `session-store.ts` | Provide validated create/read/compare-and-swap persistence | Shared contracts and optional PostgreSQL pool |
| `PATCH /sessions/:sessionId/state` | Validate ordering and merge supported observations | Session store, threshold detector |
| `thresholds.ts` | Report material field changes against explicit deterministic thresholds | Two typed hiking-state snapshots |

## Implemented Decision Feed Components

| Component | Responsibility | Depends on |
|---|---|---|
| PostgreSQL/in-memory event store | Append contiguous typed decision events atomically with session transitions | `SessionStore` and latest decision |
| `GET /sessions/:sessionId/events` | Return events strictly after a validated cursor | Event log and shared response schema |
| `DecisionFeed.tsx` | Render the latest four chronological decision signals and connection state | Typed decision events |
| `App.tsx` event poller | Poll every five seconds and atomically update state, scores, and recommendation | Events endpoint |

## Implemented Adapter Authentication

| Component | Responsibility | Depends on |
|---|---|---|
| `adapter-auth.ts` | Validate startup configuration and compare bearer credentials in constant time | Node crypto and server environment |
| State-update auth gate | Reject unauthorized mutation before session lookup or body validation | Adapter auth config |

## Implemented Weather Components

| Component | Responsibility | Depends on |
|---|---|---|
| `weather-adapter.ts` | Fetch, validate, normalize, and attribute current weather/daylight | Configured HTTPS Open-Meteo endpoint |
| Session weather initializer | Use live environmental state when available and explicitly fall back otherwise | Weather provider and hike coordinates |
| `SessionHud` provenance | Display provider and license attribution for live environmental data | Optional state provenance contract |

## Implemented Automatic Weather Refresh Components

| Component | Responsibility | Depends on |
|---|---|---|
| `weather-refresh.ts` | Schedule serialized active-session refresh cycles and deduplicate provider calls per hike | `SessionStore`, weather provider, hike locations |
| `session-state.ts` | Apply stale checks, threshold detection, evaluation, event creation, and compare-and-swap persistence for every state source | Session record, hike catalog, evaluation and policy |
| `SessionStore.listActiveSessionIds` | Discover durable active sessions after startup or across API instances | In-memory map or PostgreSQL `sessions.status` |

## Implemented Freshness Status Components

| Component | Responsibility | Depends on |
|---|---|---|
| `environmental-status.ts` | Validate freshness configuration and derive current, expired, failed, or prototype status | Observation/receipt timestamps and refresh cadence |
| Freshness status persistence | Atomically record successful duplicate checks and failures without publishing recommendation events | `SessionStore` compare-and-swap |
| `SessionHud.tsx` freshness signal | Show current, stale/failure, unknown, or prototype state and label retained stale values | Session environmental status and observation time |
| Event-feed snapshot fields | Deliver latest state/status on every cursor poll, including empty event batches | Durable session record |

## Browser Verification Components

| Component | Responsibility | Depends on |
|---|---|---|
| `playwright.config.ts` | Start isolated API and web servers and run deterministic desktop/mobile projects | Chromium, Fastify, Vite |
| `tests/e2e/core-flow.spec.ts` | Verify the integrated user flow and stale-state behavior at the browser boundary | Public API and rendered UI contracts |
## Operational Guardrail Components

| Component | Responsibility | Depends on |
|---|---|---|
| `operational-config.ts` | Validate logging, CORS, rate-limit, and event-page settings | Environment and Zod |
| Fastify rate-limit hook | Bound non-health traffic by client IP | `@fastify/rate-limit` process-local store |
| Liveness/readiness routes | Separate process health from session-store availability | `SessionStore.readiness` |

## Retention Components

| Component | Responsibility | Depends on |
|---|---|---|
| `retention.ts` | Validate retention settings and schedule cutoff sweeps | `SessionStore.purgeExpired` |
| In-memory/PostgreSQL stores | Delete records older than the cutoff | Session activity timestamps; database cascade |
| `sessions_updated_at_idx` | Keep PostgreSQL age scans indexable | Migration 002 |