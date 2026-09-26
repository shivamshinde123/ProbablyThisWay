# Code Flow

This is a living map of entry points, runtime paths, and dependencies. Update it as implementation is added or changed.

## Current Repository State

The `ProbablyThisWay` repository is an npm-workspaces monorepo. The React/Vite client, Fastify API, and shared Zod contract package are implemented as the first runnable foundation.

## Planned Entry Points

| Entry point | Trigger | Responsibility |
|---|---|---|
| `apps/web/src/main.tsx` | Browser loads the product | Mount the React application |
| `apps/web/src/App.tsx` | React mount | Load supported hikes and render the map-first UI |
| `apps/web/src/components/TerrainMap.tsx` | Map stage mounts | Create and configure Cesium, draw the route preview, set the camera, and destroy the viewer on unmount |
| `apps/api/src/server.ts` | API process starts | Build and listen on the configured host and port |
| `apps/api/src/app.ts` | HTTP request | Configure Fastify and serve health/hike routes |
| `packages/contracts/src/index.ts` | API or web import | Validate and type shared request/response data |
| Session creation API | User starts a hike session | Load hike data, initialize questions/state, and run the first evaluation |
| State update API | Authorized live input arrives | Normalize/persist state and invoke threshold detection |
| Evaluation worker/service | Session start or threshold crossing | Score routes, apply policy, persist and publish the decision |
| Events endpoint | Client requests updates | Return ordered decision-feed events |

## Planned Primary Flow

```text
`apps/web/src/main.tsx`
  -> `App`
  -> fetch hike catalog
  -> `GET /api/v1/hikes`
  -> select the first supported hike
  -> `GET /api/v1/hikes/{hikeId}`
  -> validate catalog with `hikesResponseSchema`
  -> validate detail and trail geometry with `hikeDetailSchema`
  -> initialize the first route as selected
  -> pass all typed route features and the selected ID to `TerrainMap`
  -> user chooses hike
  -> create session
      -> load trail and candidate routes
      -> select approved Jev questions
      -> assemble state snapshot
      -> evaluate every route
      -> apply deterministic route policy
      -> persist evaluation and event
  -> render terrain, routes, HUD, recommendation, and feed
```

## Planned Update Flow

```text
live input adapter
  -> validate and normalize observation
  -> persist ordered state snapshot
  -> threshold detector
      -> no meaningful change: stop
      -> threshold crossed: enqueue evaluation
  -> Jev evaluation
  -> deterministic route policy
  -> persist decision event
  -> client refresh/stream update
```

There is no simulation-button or simulated-condition runtime path.

## Dependency Direction

```text
web client -> CesiumJS and API contracts
API contracts -> application use cases -> domain policy
                                    -> integration interfaces
server integration adapters -> weather / Jev / optional LLM / PostgreSQL
```

Domain logic must remain independent of React, Cesium, HTTP frameworks, database drivers, and provider SDKs.

## Implementation Tracking

When code is added, replace planned labels with real file paths and record:

- startup/bootstrap files;
- routes and handlers;
- background workers and scheduled jobs;
- important function-to-function call paths;
- state ownership and event propagation;
- external dependencies and failure paths.
## Implemented Session Start Flow

```text
selected hike + selected route
  -> POST /api/v1/sessions
  -> validate createSessionRequestSchema
  -> verify route belongs to hike
  -> create typed prototype-static HikingState snapshot
  -> validate sessionSchema on API and client
  -> lock route selection
  -> render SessionHud over the map
```

## Implemented Initial Evaluation Flow

```text
POST /api/v1/sessions
  -> validate hike and selected route
  -> create prototype-static hiking-state snapshot
  -> evaluateRoutes
      -> JEV_API_KEY configured
          -> send one shared state + one Noul question per valid route
          -> validate bounded probabilities
          -> provider = jev
      -> credentials absent or Jev request fails
          -> calculate documented deterministic baseline
          -> provider = deterministic-baseline
  -> store latest evaluation in process memory
  -> return typed session + evaluation
  -> App renders every suitability score on its route card
```

The map selection remains unchanged in this stage. Applying deterministic route policy and highlighting the highest-ranked route is the next flow.
