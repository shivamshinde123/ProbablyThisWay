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
| `ConditionsHud` | Current weather, time, pace, fatigue, and progress when available | Hiking state |
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
