# Product Requirements Document

## Product

ProbablyThisWay is a map-first hiking decision-support prototype. It displays a real trail and valid route alternatives on 3D terrain, evaluates those alternatives against current conditions through Jev on OpenRouter's typed Decisions API, and highlights the most suitable route.

## Goal

Prove that structured, explainable decision evaluation can turn trail, environmental, and user-state data into a useful route recommendation.

## Primary User

A hiker discovering a named trail anywhere OpenStreetMap has searchable line geometry, or selecting an evaluated route in a reviewed supported area.

## MVP Requirements

- Search the internet trail index by trail name and location, select attributed line geometry, and explicitly start an evaluated session for the chosen result.
- Render its terrain, trail, and route alternatives.
- Display weather, time, pace, fatigue, elevation, distance, daylight, and route progress when available. Hide or clearly mark unavailable values; live GPS is not required for the MVP.
- Evaluate every candidate route through a defined, schema-constrained route-suitability request.
- Apply deterministic application policy to the results, excluding official illegal/closed/restricted routes before ranking and returning no route when every candidate is ineligible.
- Highlight the current recommendation and show suitability values.
- Automatically preview the recommended geometry with a clearly labeled start-to-finish pointer animation, visible completion progress, synchronized model-to-policy decision replay, and pause/replay controls. Keep the complete scored response and auditable decision trace available after evaluation: normalized inputs, every provider score, policy version, exclusions with reasons, factors, and final explanation. Do not request or imply access to private model chain-of-thought. This is a route preview, not the hiker's live position.
- Provide visible, keyboard-accessible zoom in/out, directional pan, and terrain framing controls in addition to direct mouse/touch Cesium navigation.
- Explain the factors behind the recommendation without presenting it as a safety guarantee.
- Re-evaluate automatically when supported live inputs materially change.
- Do not expose a simulation button or simulated-condition workflow.

## Out of Scope

Live GPS tracking, wearables, automatic fatigue detection, offline maps, social features, emergency response, route sharing, turn-by-turn navigation, authoritative access validation for arbitrary internet trails, and machine-learned pace prediction are not MVP commitments.

## Success Criteria

A user can search for a named trail, select the result, start it, see every mapped candidate branch scored, receive a visible initial recommendation, and understand which provider or fallback produced the scores and why application policy chose the route. Subsequent evaluations run automatically after relevant supported inputs cross configured thresholds.

## Safety Requirement

The product is decision support, not an emergency or navigation guarantee. UI copy must encourage users to consider official trail guidance and their own judgment.

## Release Boundaries

- Internet discovery coverage: direct line matches plus bounded nearby mapped paths when OpenStreetMap resolves a named hill, park, or trail area as a point/polygon. Selected results can be evaluated, but remain unreviewed geometry with unknown access, exposure, condition, and elevation.
- Launch area: Wachusett Mountain State Reservation. The MVP uses the Massachusetts DCR Roads and Trails layer for Pine Hill, Mountain House, and Harrington summit corridors, plus the official DCR trail map for published metrics.
- Live position data is post-MVP. Until it exists, actual hike progress is omitted or marked unavailable rather than inferred from fabricated location data. A clearly labeled animated route preview may demonstrate the recommended geometry but must never be presented as live GPS.
- The repository is provider-neutral and supports one API replica behind the shipped Nginx proxy. Cloud, DNS, TLS, registry, secret-manager, backup, alerting, and metrics products are operator choices.
- MVP sessions are anonymous capability URLs and contain no user account or live GPS history. Server-to-server state adapters use the implemented bearer credential. Account authentication and product analytics are outside the MVP.
