# System Architecture Document

## Overview

The system separates geospatial truth, changing hike state, decision evaluation, deterministic route policy, and presentation.

```text
Trail + terrain data ──> GIS/routing ──> candidate routes ──┐
Weather/time/user state ──────────────> state service ──────┼─> Jev evaluation
Question configuration <──── optional LLM enhancement ──────┘         │
                                                                      v
                                                               route policy
                                                                      │
                                       3D map + HUD + decision feed <──┘
```

## Boundaries

- **Web client:** selection, 3D visualization, HUD, route cards, and decision feed.
- **Application API:** session orchestration, validation, state updates, and read models.
- **GIS/routing:** trail geometry, elevation calculations, progress, and valid alternatives.
- **Decision service:** prepares questions and invokes Jev.
- **Policy service:** chooses the recommendation from structured scores and hard constraints.
- **Integration adapters:** weather, trail/elevation sources, LLM, and Jev.
- **Database:** trail, route, session, state, evaluation, and event persistence.

## Key Rules

- The LLM does not directly select the final route.
- The approved deterministic question catalog is sufficient to start a session. LLM question selection is an optional enhancement and must fall back to that catalog.
- Route geometry comes from trusted geospatial data, not generated text.
- Re-evaluation is event/threshold driven and automatic; there is no simulation control.
- Every recommendation records its input snapshot, question set, scores, policy outcome, and timestamp.

## Deployment

GitHub Actions verifies tests, TypeScript checks, and production builds before changes reach `main`. Deployment topology, scaling targets, branch-protection policy, and cloud provider are TBD.

## Current Prototype Runtime

The API combines session orchestration, live weather initialization and periodic refresh, threshold detection, evaluation, policy, and the ordered event API in one Fastify process. A `SessionStore` boundary selects PostgreSQL when `DATABASE_URL` is configured and an in-memory implementation for local development/tests. PostgreSQL transactions persist each session transition with its events, while a state-sequence compare-and-swap rejects concurrent overwrites. The client polls an independent event cursor to refresh its read model. End-user identity, a queue, PostGIS-backed route data, and event streaming remain future deployment boundaries. The state mutation route has a server-only adapter bearer boundary.
