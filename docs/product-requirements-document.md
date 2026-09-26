# Product Requirements Document

## Product

ProbablyThisWay is a map-first hiking decision-support prototype. It displays a real trail and valid route alternatives on 3D terrain, evaluates those alternatives against current conditions with Jev, and highlights the most suitable route.

## Goal

Prove that structured, explainable decision evaluation can turn trail, environmental, and user-state data into a useful route recommendation.

## Primary User

A hiker selecting or following one of the predefined supported trails.

## MVP Requirements

- Select a predefined hike.
- Render its terrain, trail, and route alternatives.
- Display weather, time, pace, fatigue, elevation, distance, daylight, and route progress when available. Hide or clearly mark unavailable values; live GPS is not required for the MVP.
- Evaluate every candidate route through a defined Jev question set.
- Apply deterministic application policy to the results.
- Highlight the current recommendation and show suitability values.
- Explain the factors behind the recommendation without presenting it as a safety guarantee.
- Re-evaluate automatically when supported live inputs materially change.
- Do not expose a simulation button or simulated-condition workflow.

## Out of Scope

Live GPS tracking, wearables, automatic fatigue detection, offline maps, social features, emergency response, route sharing, broad trail search, and machine-learned pace prediction are not MVP commitments.

## Success Criteria

A user can open a supported hiking area, inspect multiple valid routes and current context, receive the automatic initial evaluation, and understand which route is recommended and why. Subsequent evaluations run automatically after relevant supported inputs cross configured thresholds.

## Safety Requirement

The product is decision support, not an emergency or navigation guarantee. UI copy must encourage users to consider official trail guidance and their own judgment.

## Open Decisions

- Launch area: Wachusett Mountain State Reservation. The MVP uses the Massachusetts DCR Roads and Trails layer for Pine Hill, Mountain House, and Harrington summit corridors, plus the official DCR trail map for published metrics.
- Live position data is post-MVP. Until it exists, route progress is omitted or marked unavailable rather than inferred from fabricated location data.
- Hosting, end-user authentication, and analytics requirements: TBD. Server-to-server state adapters use the implemented bearer credential.
