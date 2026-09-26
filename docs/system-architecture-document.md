# System Architecture Document

## Overview

The system separates geospatial truth, changing hike state, decision evaluation, deterministic route policy, and presentation.

```text
reviewed route snapshot -----> candidate routes ----+
live weather + user state ---> session state -------+--> Jev/baseline scores
approved question catalog --------------------------+          |
                                                               v
                                                deterministic policy
                                                               |
                                                               v
                                              map + HUD + decision feed
```

## Boundaries

- **Web client:** selection, 3D visualization, HUD, route cards, and decision feed.
- **Application API:** session orchestration, validation, state updates, and read models.
- **GIS/routing:** reviewed Massachusetts DCR trail snapshot, official route metrics, terrain clamping, and valid alternatives.
- **Decision service:** prepares questions and invokes Jev.
- **Policy service:** chooses the recommendation from structured scores and hard constraints.
- **Integration adapters:** weather, trail data, Jev, and PostgreSQL.
- **Database:** durable session, state, evaluation, migration, and event persistence; route geometry remains a versioned source snapshot.

## Key Rules

- Jev produces structured suitability scores; deterministic application policy alone selects the final route.
- The approved deterministic question catalog is the release question source. No LLM runtime or credential is required.
- Route geometry comes from trusted geospatial data, not generated text.
- Re-evaluation is event/threshold driven and automatic; there is no simulation control.
- Legal status, closures, restrictions, and prohibitive advisories override suitability before route selection; return no route when all candidates are excluded.
- Every recommendation records its input snapshot, question set, scores, policy outcome, and timestamp.

## Deployment

GitHub Actions verifies tests, PostgreSQL migrations/retention, TypeScript checks, production builds, Compose configuration, both production container images, and browser flows before changes reach `main`. The supported deployment topology is Nginx web/reverse proxy -> Fastify API -> PostgreSQL 17, with a one-shot migration service gating API startup. The supported release topology runs one API replica. Cloud provider and managed-service products remain operator choices.

## Current Prototype Runtime

The API combines session orchestration, live weather initialization and periodic refresh, threshold detection, evaluation, policy, and the ordered event API in one Fastify process. A `SessionStore` boundary selects PostgreSQL when `DATABASE_URL` is configured and an in-memory implementation for local development/tests. PostgreSQL transactions persist each session transition with its events, while a state-sequence compare-and-swap rejects concurrent overwrites. The client polls an independent event cursor that always returns the latest state and environmental freshness status alongside any new decisions, allowing refresh failures and below-threshold updates to refresh the HUD. The release intentionally has no end-user account system, queue, PostGIS dependency, or event stream: anonymous capability sessions, synchronous bounded evaluation, the immutable route snapshot, and cursor polling satisfy the MVP. The state mutation route has a server-only adapter bearer boundary. Horizontal scaling requires a new design for distributed scheduling and rate limits.

## Internet Discovery Boundary

The browser submits a search to the Fastify API; it never calls the public geocoder directly. The API serializes and caches Nominatim requests, validates GeoJSON through shared contracts, and returns attributed preview geometry. This discovery path does not write to PostgreSQL and does not enter the Jev/policy pipeline. Reviewed route snapshots remain the only source for field-session alternatives and recommendations.

## Terrain Provider Boundary

Terrain rendering is a browser integration. Cesium World Terrain is selected only when a scoped ion token is configured; otherwise Cesium loads the public ArcGIS World Elevation Terrain3D ImageServer. Route evaluation does not consume rendered tile heights: reviewed ascent metrics remain the decision input. Provider credits are part of the map UI, and terrain failure degrades only visualization.
