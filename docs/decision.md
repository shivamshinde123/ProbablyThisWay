# Decision Log

Record material product and engineering decisions chronologically. Do not rewrite past decisions silently; append a superseding decision and link the earlier entry.

## DEC-001 — Use a map-first product layout

- **Status:** Accepted
- **Context:** Terrain, trail geometry, alternatives, and the active recommendation are the product's central information.
- **Decision:** Make the 3D map the primary surface, with conditions, route comparison, explanation, and decision feed as supporting panels.
- **Reasoning:** Spatial comparison is clearer on the terrain than in a text-first dashboard.

## DEC-002 — Keep final route choice deterministic

- **Status:** Accepted
- **Context:** An LLM may help select relevant Jev questions and explain results, but hiking recommendations must be auditable and repeatable.
- **Decision:** Jev produces structured evaluations; application policy applies constraints/ranking and selects the final route. The LLM does not directly select it.
- **Reasoning:** This preserves explainability, testability, and a defensible safety boundary.

## DEC-003 — Remove condition simulation

- **Status:** Accepted
- **Context:** The initial plan included a button that fabricated changes to time, weather, pace, and fatigue.
- **Decision:** Do not implement a simulation button or production simulation workflow. Re-evaluation occurs only from supported live or explicitly entered state.
- **Reasoning:** Simulation is not required for the desired product experience and adds UI and state-management complexity.

## DEC-004 — Use React, TypeScript, CesiumJS, Node.js, Jev, and PostgreSQL/PostGIS

- **Status:** Proposed by source plan; implementation confirmation pending
- **Context:** The project needs a typed web UI, 3D geospatial rendering, backend orchestration, structured decision evaluation, and spatial persistence.
- **Decision:** Treat this stack as the current baseline.
- **Reasoning:** Each technology maps to a stated core requirement. Exact frameworks, providers, and tooling remain TBD until implementation begins.

## DEC-005 — Maintain a standard project documentation set

- **Status:** Accepted
- **Context:** Project intent and engineering decisions need durable, discoverable documentation.
- **Decision:** Maintain the required documents under `docs/`, including this decision log and `flow.md`.
- **Reasoning:** Keeping specifications close to the code reduces context loss and makes changes reviewable.

## DEC-006 — Use automatic, threshold-driven evaluation

- **Status:** Accepted
- **Context:** Earlier wording could imply both a user-triggered evaluation and evaluation after every state update.
- **Decision:** Run the initial evaluation during session creation. After that, queue evaluations only when a supported normalized input crosses a configured threshold. Do not expose an MVP evaluation button.
- **Reasoning:** This aligns the API, runtime flow, and UI while avoiding unnecessary evaluations.

## DEC-007 — Keep live GPS and route progress out of the MVP

- **Status:** Accepted
- **Context:** Live GPS was out of scope while some component descriptions expected route progress.
- **Decision:** Do not calculate route progress without a real supported position source. Omit it or mark it unavailable in the MVP; add it with the future GPS capability.
- **Reasoning:** Progress must not be inferred from fabricated location data.

## DEC-008 — Make LLM question selection optional

- **Status:** Accepted
- **Context:** Some documents treated the LLM as mandatory at session start while others described it as optional.
- **Decision:** Use the approved deterministic Jev question catalog by default. An enabled LLM may choose a bounded subset, generate candidate questions subject to validation, or explain results, but failure must fall back to deterministic behavior.
- **Reasoning:** Sessions remain reliable, repeatable, and testable without an LLM dependency.

## DEC-009 — Keep Cesium in the web-client boundary

- **Status:** Accepted
- **Context:** Cesium was listed both as a frontend library and as a server integration adapter.
- **Decision:** CesiumJS and its scoped browser token belong to the web client. Server adapters handle weather, Jev, optional LLM calls, and persistence.
- **Reasoning:** This matches the rendering architecture and avoids treating a browser visualization library as a backend dependency.

## DEC-011 — Use npm workspaces, Vite, Fastify, and Zod for the foundation

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** The first implementation needs a small, typed foundation spanning the web client, API, and shared contracts.
- **Decision:** Use npm workspaces for the monorepo, Vite for the React client, Fastify for the Node API, and Zod for runtime-valid shared contracts.
- **Reasoning:** These choices keep setup lightweight, establish strict API boundaries early, and retain the React/TypeScript/Node direction already selected in the project plan.
- **Consequences:** Shared contracts must build before dependent workspaces. Root scripts enforce that order.

## DEC-012 — Establish an alpine field-instrument visual direction

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** The map-first interface needs a recognizable design language appropriate to outdoor route decisions.
- **Decision:** Use deep spruce surfaces, topographic linework, high-visibility orange, compact telemetry typography, and editorial route messaging.
- **Reasoning:** The result feels like purpose-built field equipment and keeps route information visually dominant without resembling a generic dashboard.

## Entry Template

```text
## DEC-NNN — Title
- Status: Proposed | Accepted | Superseded | Rejected
- Date: YYYY-MM-DD
- Context: What prompted the decision?
- Decision: What was chosen?
- Reasoning: Why this option?
- Consequences: What tradeoffs or follow-up work result?
- Supersedes/Superseded by: DEC-NNN, when applicable
```
