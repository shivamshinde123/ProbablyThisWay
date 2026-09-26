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

Supported input adapters publish normalized state changes. A threshold detector compares the new snapshot with the last evaluated snapshot and queues a new evaluation only when a relevant threshold is crossed. Requests use a session-scoped sequence number so stale results cannot replace newer results. This process is automatic; the MVP has no user-facing evaluation control.

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

API framework, queue mechanism, cache strategy, authentication, exact scoring schema, and operational SLOs.
