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
| Hike catalog | Supported-hike metadata | Database |
| Session service | Session lifecycle | Catalog, state store |
| State normalizer | Canonical hiking state | Input adapters |
| Threshold detector | Decide when to re-evaluate | State snapshots |
| Route service | Candidate geometry and metrics | GIS/PostGIS |
| Question service | Approved Jev question set | Catalog, optional LLM |
| Evaluation service | Evaluate every route | Jev adapter |
| Route policy | Constraints, ranking, final choice | Evaluation results |
| Event service | Persist/serve decision feed | Database |
| Explanation service | Optional concise rationale | Structured decision, optional LLM |

## Dependency Rule

UI and external adapters depend inward on application/domain interfaces. Domain policy must not depend on React, Cesium, HTTP, database drivers, Jev SDK details, or an LLM SDK.

## Implemented Evaluation Components

| Component | Responsibility | Depends on |
|---|---|---|
| `evaluation.ts` | Invoke Jev with typed route questions or produce the labeled deterministic baseline | Hiking state, valid route alternatives, server environment |
| Evaluation store | Retain the latest result for the current process | Session ID |
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
| `app.ts` session store | Retain current session, latest decision, sequence, and last evaluated snapshot for the process lifetime | Shared contracts |
| `PATCH /sessions/:sessionId/state` | Validate ordering and merge supported observations | Session store, threshold detector |
| `thresholds.ts` | Report material field changes against explicit deterministic thresholds | Two typed hiking-state snapshots |

## Implemented Decision Feed Components

| Component | Responsibility | Depends on |
|---|---|---|
| In-memory event log | Append contiguous typed decision events per session | Session record and latest decision |
| `GET /sessions/:sessionId/events` | Return events strictly after a validated cursor | Event log and shared response schema |
| `DecisionFeed.tsx` | Render the latest four chronological decision signals and connection state | Typed decision events |
| `App.tsx` event poller | Poll every five seconds and atomically update state, scores, and recommendation | Events endpoint |
