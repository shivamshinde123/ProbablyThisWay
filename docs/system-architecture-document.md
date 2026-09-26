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

Deployment topology, scaling targets, and cloud provider are TBD.

## Current Prototype Runtime

The API currently combines session orchestration, threshold detection, evaluation, policy, an ordered event log, and an in-memory read model in one Fastify process. Sequence checks prevent an older concurrent evaluation from replacing a newer decision, while the client polls an independent event cursor to refresh its read model. Durable storage, end-user identity, a queue, and event streaming remain future deployment boundaries. The state mutation route now has a server-only adapter bearer boundary.
