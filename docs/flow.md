# Code Flow

This is a living map of entry points, runtime paths, and dependencies. Update it as implementation is added or changed.

## Current Repository State

The repository currently contains product/design documentation only. Application entry points and executable dependencies are not implemented yet.

## Planned Entry Points

| Entry point | Trigger | Responsibility |
|---|---|---|
| Web application | User opens the product | Load supported hikes and render the map-first UI |
| Session creation API | User starts a hike session | Load hike data, initialize questions/state, and run the first evaluation |
| State update API | Authorized live input arrives | Normalize/persist state and invoke threshold detection |
| Evaluation worker/service | Session start or threshold crossing | Score routes, apply policy, persist and publish the decision |
| Events endpoint | Client requests updates | Return ordered decision-feed events |

## Planned Primary Flow

```text
Web bootstrap
  -> fetch hike catalog
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
