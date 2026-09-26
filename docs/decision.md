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

## DEC-013 — Integrate Cesium with a token-optional terrain mode

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** The map-first experience needs a real interactive 3D globe before authoritative trail datasets are connected.
- **Decision:** Embed CesiumJS directly in a React lifecycle component, copy required Cesium assets during Vite builds, enable World Terrain when `VITE_CESIUM_ION_ACCESS_TOKEN` is configured, and otherwise render an ellipsoid preview.
- **Reasoning:** The application remains runnable for every contributor while supporting high-resolution terrain through a scoped browser token in configured environments.
- **Consequences:** Cesium substantially increases the web bundle size, so future work should evaluate route-level lazy loading and chunking.

## DEC-014 — Move trail geometry behind a typed hike-detail API

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** The first Cesium integration embedded coordinates directly in the UI, preventing provenance tracking, validation, and later dataset replacement.
- **Decision:** Serve GeoJSON-compatible trail features from `GET /api/v1/hikes/{hikeId}`, validate the same Zod contract on server and client, and pass the resulting feature into the map component.
- **Reasoning:** This establishes the production data boundary early and keeps Cesium focused on visualization rather than owning trail data.
- **Consequences:** The current feature is explicitly labeled `preview` and cannot be used for navigation or route decisions until replaced by a licensed authoritative source.

## DEC-015 — Model route alternatives as metric-bearing geospatial features

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** A single trail line cannot support comparison or later Jev evaluation across valid alternatives.
- **Decision:** Require at least two route features per hike detail. Each feature owns geometry, provenance, distance, gain, estimated duration, and exposure; the selected route ID is UI state shared with the map.
- **Reasoning:** Keeping metrics beside geometry makes every displayed alternative self-describing and provides a stable input shape for the next decision-evaluation stage.
- **Consequences:** All current alternatives remain preview-only until authoritative route generation replaces the prototype seed.

## DEC-016 — Start sessions with an explicitly static hiking-state snapshot

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Jev evaluation needs a structured state boundary before live providers are connected.
- **Decision:** `POST /api/v1/sessions` validates the selected hike and route, creates an active session, and returns weather, daylight, pace, and fatigue under `source: prototype-static`.
- **Reasoning:** This establishes the end-to-end state contract and HUD without implying the fixture is live or introducing a simulation control.
- **Consequences:** Route selection locks after session start. Live adapters will replace the static source in a later stage without changing the session-state shape.

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

## DEC-017 — Use a server-side Jev adapter with an explicit deterministic baseline

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Jev is a hosted decision service requiring credentials, while contributors and automated tests need a functional local path.
- **Decision:** Send the normalized state and one typed Noul question per valid route from the API when `JEV_API_KEY` is configured. Validate the response and fall back after four seconds or any invalid response to a deterministic, locally calculated score labeled `deterministic-baseline`.
- **Reasoning:** This preserves the real integration boundary without exposing credentials to the browser or falsely presenting local arithmetic as Jev output.
- **Consequences:** Local scores are suitable for development only. Provider provenance must remain visible, and production deployment requires a Jev key plus contract verification against the configured endpoint.

## DEC-018 — Rank by suitability with stable route-order ties

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Phase 6 needs an auditable recommendation from model-produced route scores, while current route data has no closure or hard-constraint fields.
- **Decision:** Application policy selects the valid route with the highest suitability. Exact ties preserve the validated hike's existing route order. The policy emits a separate typed recommendation using version `highest-suitability-v1`.
- **Reasoning:** A pure deterministic step keeps final control outside Jev, makes outcomes repeatable, and creates a versioned boundary for adding hard constraints later.
- **Consequences:** Signal green denotes the recommendation, orange preserves the user's original choice, and the UI continues to display all scores. Closure and restriction overrides remain required future policy inputs.
