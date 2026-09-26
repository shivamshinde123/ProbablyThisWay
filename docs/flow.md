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
| `session-state.ts` evaluation transition | Session start or material state change | Score routes, apply policy, and atomically persist/publish the current decision |`n| `GET /sessions/:sessionId/events` | Client cursor poll | Return ordered typed decision events after a cursor |

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
  -> optionally search the loaded supported route names/location and select a result
  -> pass all typed route features and the selected ID to `TerrainMap`
  -> user chooses hike
  -> create session
      -> load trail and candidate routes
      -> select approved Jev questions
      -> assemble state snapshot
      -> evaluate every route
      -> apply deterministic route policy
      -> persist session, latest decision, and session_started event through SessionStore
  -> render terrain, routes, HUD, and recommendation
```

## Implemented State Update Flow

```text
PATCH /api/v1/sessions/{sessionId}/state
  -> validate adapter bearer credential before resource lookup
  -> validate source, timestamp, and non-empty supported changes
  -> reject stale observation
  -> load and merge changes into the current stored session state
  -> increment session sequence
  -> compare accumulated state with lastEvaluatedState
      -> below all thresholds: return 202 without evaluation
      -> threshold crossed: evaluate all routes
          -> apply deterministic route policy
          -> transactionally save only if the expected state sequence is still current
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
server integration adapters -> weather / Jev / PostgreSQL
```

Domain logic must remain independent of React, Cesium, HTTP frameworks, database drivers, and provider SDKs.

## Implementation Tracking

Keep this map current whenever entry points or call paths change. Record:

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
  -> request validated live weather/daylight when configured
      -> success: create attributed weather HikingState snapshot
      -> unavailable/invalid: create prototype-static fallback snapshot
  -> validate sessionSchema on API and client
  -> lock route selection
  -> render SessionHud over the map
```

## Implemented Initial Evaluation Flow

```text
POST /api/v1/sessions
  -> validate hike and selected route
  -> initialize attributed weather state or explicit prototype-static fallback
  -> evaluateRoutes
      -> JEV_API_KEY configured
          -> send one shared state + one Noul question per valid route
          -> validate bounded probabilities
          -> provider = jev
      -> credentials absent or Jev request fails
          -> calculate documented deterministic baseline
          -> provider = deterministic-baseline
  -> persist latest evaluation through SessionStore
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

## Implemented Persistence Flow

```text
API startup
  -> DATABASE_URL configured
      -> create PostgresSessionStore connection pool
      -> production session and event reads/writes use PostgreSQL
  -> DATABASE_URL absent outside production
      -> create isolated InMemorySessionStore
  -> DATABASE_URL absent in production
      -> fail startup

state transition
  -> load and validate stored SessionRecord
  -> capture expected state_sequence
  -> calculate next state and optional decision event
  -> begin PostgreSQL transaction
  -> update sessions WHERE state_sequence = expected
      -> no row: commit no write and return 409 state_update_conflict
      -> one row: insert new events idempotently and commit
  -> application shutdown closes the connection pool
```

Migration lifecycle:

```text
npm run db:migrate -w @probably-this-way/api
  -> acquire schema advisory lock
  -> bootstrap schema_migrations
  -> discover ordered NNN_name.sql files
  -> verify checksums for applied versions
  -> apply and record each pending migration
  -> release lock
```

CI provisions PostgreSQL 17, applies every migration, reruns the migration set as a no-op, and verifies tracked versions plus the retention index.

## Implemented Weather Initialization Flow

```text
POST /api/v1/sessions
  -> resolve supported hike coordinates
  -> WEATHER_API_BASE_URL configured
      -> request current temperature, wind, precipitation probability + day/night status + daily sunset
      -> enforce HTTPS, explicit units, UTC, schema validation, and four-second timeout
      -> normalize probability and daylight remaining
      -> attach Open-Meteo / CC BY 4.0 provenance
  -> provider absent at production startup
      -> fail configuration validation
  -> request fails in production
      -> return 503 weather_unavailable
  -> provider absent or request fails outside production
      -> log a warning when applicable
      -> use visibly labeled prototype-static state
  -> evaluate every route from the resulting immutable snapshot
```

No browser control can manufacture or override environmental conditions.

## Continuous Integration Flow

```text
pull request targeting main or push to main
  -> cancel any superseded run for the same PR/ref
  -> check out the triggering commit without persisted credentials
  -> install Node.js 22 and restore npm download cache
  -> npm ci from committed package-lock.json
  -> npm test
  -> npm run check
  -> npm run build
  -> publish one Test, type-check, and build status
```

The workflow has only `contents: read` permission and receives no application secrets.

## Implemented Automatic Weather Refresh Flow

```text
API startup with WEATHER_API_BASE_URL
  -> validate WEATHER_REFRESH_INTERVAL_MS (default 5 minutes; minimum 1 minute)
  -> start one unref'd, non-overlapping refresh timer
  -> list active session IDs from SessionStore
  -> load each current session record
  -> fetch one validated weather snapshot per distinct hike
      -> record provider observedAt + server receivedAt
      -> provider failure: log and retain last valid state/decision
  -> combine environmental snapshot with preserved user state
  -> transitionSessionState
      -> stale/duplicate observation: ignore
      -> compare with last evaluated state
      -> below threshold: compare-and-swap current state only
      -> threshold crossed: evaluate, select, persist, append recommendation_updated
  -> client receives a new decision through its existing event cursor poll
API shutdown
  -> stop refresh timer
  -> close SessionStore
```

The background path and authenticated PATCH path share the same transition function. Neither path exposes a browser simulation control.

## Implemented Freshness and Refresh-Failure Flow

```text
validated provider observation
  -> record observedAt and receivedAt
  -> staleAfter = observedAt + WEATHER_FRESHNESS_MAX_AGE_MS
  -> persist current status with the state transition

scheduled provider failure
  -> retain last valid state and recommendation
  -> increment session sequence
  -> compare-and-swap stale / refresh_failed status
  -> do not append a recommendation event

GET /sessions/{sessionId}/events
  -> resolve current status against staleAfter
  -> return decision events + latest state + environmental status
  -> client updates HUD even when event items are empty
  -> current: signal green
  -> failed/expired/unknown: warning orange + last-valid-observation copy
  -> prototype-static: amber prototype label
```

This is an observational flow. It adds no refresh, evaluation, or simulation control.

## Authoritative Trail Refresh Flow

```text
npm run data:refresh:dcr
  -> query explicit Massachusetts DCR feature IDs
  -> require every segment and legal-status N
  -> order/reverse manifest segments
  -> reject geometry gaps over 20 m
  -> convert XY geometry to WGS84 coordinate triples
  -> write generated Wachusett route snapshot
  -> API parses snapshot through shared route schema
  -> hike endpoint exposes geometry plus provenance
  -> web map renders routes and links to DCR source
```

## Route Constraint Flow

```text
typed routes + suitability scores
  -> collect legal/access/restriction exclusion reasons
  -> remove hard-excluded routes before ranking
  -> eligible routes exist
       -> select highest suitability with stable route-order ties
       -> return recommended + audited exclusions
  -> no eligible routes
       -> return unavailable + every exclusion reason
  -> persist and publish the typed decision
  -> UI disables excluded cards and removes recommendation highlight
```

## Browser Verification Flow

```text
npm run test:e2e
  -> build production API and web artifacts
  -> Playwright starts the compiled Fastify server on 127.0.0.1:3001
  -> Playwright starts Vite preview on 127.0.0.1:5173
  -> desktop Chromium + Pixel 7 projects
       -> load DCR route catalog
       -> verify no simulation control
       -> select route and start session
       -> verify recommendation, HUD, feed, and map label
       -> verify mobile map/panel stacking
       -> intercept event poll with typed stale status
       -> verify last-valid-value warning
  -> retain failure artifacts under output/playwright/
```

## Operational Request Flow

```text
request
  -> CORS allowlist
  -> per-IP process-local rate limit (health routes excluded)
  -> route validation and handler
  -> structured completion/error log

/health/live -> process response
/health/ready -> SessionStore.readiness -> 200 ready or 503 unavailable
/sessions/:id/events -> validate after + limit -> return at most 100 events
```

## Retention Flow

```text
API process starts
  -> validate retention age and sweep cadence
  -> every sweep interval calculate now - retention age
  -> SessionStore.purgeExpired(cutoff)
      -> delete sessions last updated before cutoff
      -> PostgreSQL cascades deletion to decision_events
  -> log and retry on the next interval after failure
  -> stop scheduler during graceful shutdown
```
## Production Container Flow

```text
docker compose up
  -> PostgreSQL becomes healthy
  -> one-shot API image runs tracked migrations
  -> Fastify starts and passes /api/v1/health/ready
  -> Nginx starts on :8080
      -> static routes serve the built React application
      -> /api/* proxies to Fastify on the private network
  -> browser uses one public origin for UI and API
```

## Implemented Session End Flow

Active field session → user selects End field session → POST /api/v1/sessions/{sessionId}/end → load the current session record.

- Already ended: return the original ended session idempotently.
- Active: increment the compare-and-swap sequence, persist status and endedAt together, and remove the session from active weather-refresh queries.
- Client success: clear the session HUD, decision feed, and recommendation; make trail search and route selection available again.

Adapter updates and racing weather transitions check lifecycle status and stop without mutating an ended session.

## Implemented Internet Trail Search Flow

Browser submit → GET /api/v1/trails/search → validate query → check 15-minute cache → serialize public Nominatim request at one-per-second maximum → request simplified full GeoJSON → validate provider response → retain named trail-like lines → compute mapped distance → return attributed results → select result → render and camera-frame preview in TerrainMap.

The preview path stops before session creation. Choosing a reviewed route clears the internet preview and restores the evaluated-session path.
