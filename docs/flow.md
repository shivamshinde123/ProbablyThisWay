# Code Flow

This is a living map of entry points, runtime paths, and dependencies. Update it as implementation is added or changed.

## Current Repository State

The `ProbablyThisWay` repository is an npm-workspaces monorepo. The React/Vite client, Fastify API, and shared Zod contract package are implemented as the first runnable foundation.

## Runtime Entry Points

| Entry point | Trigger | Responsibility |
|---|---|---|
| `apps/web/src/main.tsx` | Browser loads the product | Mount the React application |
| `apps/web/src/App.tsx` | React mount | Load supported hikes and render the map-first UI |
| `apps/web/src/components/TerrainMap.tsx` | Map stage mounts | Create and configure Cesium, draw the route preview, set the camera, and destroy the viewer on unmount |
| `apps/api/src/server.ts` | API process starts | Build and listen on the configured host and port |
| `apps/api/src/app.ts` | HTTP request | Configure Fastify and serve health/hike routes |
| `packages/contracts/src/index.ts` | API or web import | Validate and type shared request/response data |
| Session creation API | User starts a hike session | Load hike data, initialize questions/state, and run the first evaluation |
| State update API | Bearer-authenticated supported input arrives | Authenticate, normalize/persist state, and invoke threshold detection |
| Evaluation worker/service (planned) | Future queued threshold evaluation | Score routes, apply policy, persist and publish the decision |
| `GET /sessions/:sessionId/events` | Client cursor poll | Return ordered typed decision events after a cursor |

## Primary Flow

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
      -> retain latest decision in process memory
  -> render terrain, routes, HUD, and recommendation
```

## Implemented State Update Flow

```text
PATCH /api/v1/sessions/{sessionId}/state
  -> validate adapter bearer credential before resource lookup
  -> validate source, timestamp, and non-empty supported changes
  -> reject stale observation
  -> merge changes into the current in-memory session state
  -> increment session sequence
  -> compare accumulated state with lastEvaluatedState
      -> below all thresholds: return 202 without evaluation
      -> threshold crossed: evaluate all routes
          -> apply deterministic route policy
          -> replace latest decision only if request sequence is still current
          -> advance lastEvaluatedState
          -> append recommendation_updated event
          -> return 202 with crossed fields and decision
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

The map selection remains unchanged while the deterministic route policy controls recommendation highlighting.

## Implemented Recommendation and Highlight Flow

```text
validated route scores
  -> selectRouteRecommendation
      -> discard scores not belonging to the hike
      -> choose greatest suitability
      -> exact tie: preserve stable hike route order
  -> typed RouteRecommendation
  -> session response + latest-decision read model
  -> React derives the recommended route
      -> recommendation banner and card marker
      -> TerrainMap receives recommendation ID + score
      -> Cesium renders signal-green route and recommendation label
```

The user's pre-session choice remains orange when it differs from the recommendation. Other routes remain moss. Route selection stays locked after session start.

## Implemented Phase 7 Polish Flow

```text
Start field session
  -> show accessible evaluation-progress instrument
  -> evaluate + apply policy
  -> policy derives daylight / exposure / elevation facts
  -> return typed explanation and factors
  -> render recommendation panel
  -> compute recommended-route bounding sphere
  -> smoothly frame route once
      -> reduced-motion preference: immediate camera change
```

Responsive breakpoints keep the map dominant, collapse recommendation evidence to one column on narrow screens, and preserve readable HUD telemetry.

## Implemented Decision Feed Flow

```text
session created
  -> append session_started event at cursor 1
  -> client polls GET /sessions/{sessionId}/events?after={cursor}
  -> validate typed event batch
  -> deduplicate by event ID
  -> apply newest event atomically to:
      -> hiking-state HUD
      -> route scores and recommendation
      -> chronological decision feed
  -> wait five seconds and request after nextCursor
      -> request failure: mark feed retrying and continue polling
```

Event cursors are independent from accepted state-update sequences. This keeps feed pagination contiguous even when below-threshold updates do not publish a decision.
