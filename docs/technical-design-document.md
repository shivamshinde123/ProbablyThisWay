# Technical Design Document

## Session Flow

1. Client requests supported hikes and selects one.
2. API loads trail geometry, terrain references, and candidate routes.
3. At session start, the question service loads a deterministic approved Jev question set. If the optional LLM integration is enabled, it may select a bounded subset; unavailable or invalid LLM output falls back to the approved default set.
4. The state service assembles the current hiking-state snapshot.
5. Jev evaluates each candidate route using the same snapshot and questions.
6. Policy rejects hard-constraint violations, ranks remaining routes, and selects one.
7. API persists the evaluation and emits a decision event.
8. Client updates route styling, cards, HUD, and feed.

## Re-Evaluation

`PATCH /api/v1/sessions/{sessionId}/state` validates supported source-specific changes and rejects observations whose timestamp is not newer than the session's current state. The detector compares the accumulated state with the last evaluated snapshot, not merely the preceding update. Thresholds are 10 F temperature, 5 mph wind, 0.15 rain probability, 10 minutes remaining daylight, 15% relative pace, and any fatigue-level change.

Every accepted update increments a session-scoped sequence. A threshold crossing runs evaluation synchronously in the current process; the result replaces the latest decision only if its captured sequence is still current, preventing an older concurrent result from overwriting newer state. A future worker can preserve the same contract while making the operation asynchronous. This process is automatic and has no user-facing evaluation control.

## Reliability

- Validate all external data at adapter boundaries.
- Make evaluation writes idempotent with a request key.
- Time out external Jev and LLM calls explicitly.
- Retain the last valid recommendation when a refresh fails, but visibly mark its age/error state.
- Never silently convert missing safety-relevant input into a favorable score.

## Security and Privacy

- Keep secrets server-side.
- Minimize stored location and user-state data.
- Define retention and deletion policy before collecting personal GPS history.
- Rate-limit public endpoints and validate geometry/query bounds.

## Testing

- Unit tests for thresholds, score normalization, and policy.
- Contract tests for adapters and API schemas.
- Integration tests from state snapshot through persisted decision.
- Browser tests for trail selection and recommendation rendering.
- Golden scenarios for stable route-policy outcomes.

## TBD

Queue mechanism, cache strategy, authentication, production persistence, calibrated scoring policy, and operational SLOs.

## Implemented Jev Adapter

The API owns Jev credentials and calls the configured decision endpoint with a four-second timeout. Each route maps to one Noul question, and the response must provide a probability in `[0, 1]` for every returned answer. The application contract records provider provenance as `jev` or `deterministic-baseline`. Network or validation failures do not block session startup; they degrade visibly to the baseline. Recommendation policy remains separate and is not implemented by this adapter.

## Implemented Recommendation Policy

`selectRouteRecommendation` is pure application policy. It indexes scores by route ID, considers only routes in the validated hike, and selects the greatest suitability. Exact ties retain the hike's stable route order. The result records `highest-suitability-v1`, the winning score, and a decision timestamp. Jev and the deterministic baseline only supply scores; neither controls the final route directly.

## Deterministic Explanation and Camera Behavior

The recommendation policy creates explanation copy only from validated route metrics and the same hiking-state snapshot used for evaluation. It does not generate hidden reasoning or call an LLM. The client renders those facts directly. When the recommendation first arrives, Cesium computes a bounding sphere from that route's coordinates and flies to it once; `prefers-reduced-motion` changes the transition duration to zero.

## Implemented Decision Events

A session publishes `session_started` after the initial decision and `recommendation_updated` only after a current-sequence threshold evaluation succeeds. Event sequence is contiguous and independent of state-update sequence. `GET /sessions/{sessionId}/events` performs cursor filtering and returns the last delivered sequence as `nextCursor`. The client validates every batch and uses recursive five-second polling so requests do not overlap. Failed reads mark the feed as retrying without discarding the last valid decision.
