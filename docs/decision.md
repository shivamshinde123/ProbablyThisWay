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

## DEC-019 — Explain recommendations from validated facts

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** The MVP needs a short explanation, but optional LLM availability must not block or embellish the recommendation.
- **Decision:** Build the first explanation deterministically from the winning route's estimated duration, daylight margin, exposure, and elevation. Return the copy and display facts in the typed recommendation contract. Frame the route once in Cesium and honor reduced-motion preferences.
- **Reasoning:** Users receive immediate, auditable context from the exact evaluated inputs without introducing another model dependency or hidden reasoning.
- **Consequences:** Explanations remain concise and factual. Future optional LLM wording may improve prose only if it preserves these facts and never delays the route update.

## DEC-020 — Compare cumulative state against explicit re-evaluation thresholds

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Automatic updates need deterministic trigger rules, and individually small observations must not prevent a material cumulative change from being evaluated.
- **Decision:** Compare the current accumulated state with the last successfully evaluated snapshot. Trigger at 10 F temperature, 5 mph wind, 0.15 rain probability, 10 minutes remaining daylight, 15% relative pace, or any fatigue change. Increment a session sequence for every accepted update and publish a result only when its sequence is still current.
- **Reasoning:** Explicit thresholds make evaluation frequency testable and auditable; the last-evaluated baseline allows small changes to accumulate without evaluating every observation.
- **Consequences:** Evaluation remains synchronous. The process-memory persistence limitation and adapter-authentication follow-ups were resolved by DEC-023 and DEC-022 respectively; threshold calibration and a queued worker remain future work.

## DEC-021 — Publish typed decisions through an independent event cursor

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Automatic re-evaluation must become visible to the active client, while below-threshold state updates should not create empty positions in the decision feed.
- **Decision:** Append `session_started` and `recommendation_updated` events with their own contiguous sequence. Include the exact state snapshot and typed decision in each event. Poll the cursor endpoint every five seconds in the MVP and retry passively after failures.
- **Reasoning:** A separate event cursor produces simple, lossless incremental reads and lets the HUD, map, scores, and explanation update from one coherent record.
- **Consequences:** The browser can observe external supported updates without a manual control. The process-memory event limitation was resolved by DEC-023 when PostgreSQL is configured; retention, pagination limits, end-user authentication, and streaming remain future work.

## DEC-022 — Protect state mutation with a fail-closed adapter credential

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Supported weather and user-input adapters can alter the state used for route recommendations, so the mutation boundary must not remain publicly writable.
- **Decision:** Require `Authorization: Bearer <token>` for state updates whenever `STATE_ADAPTER_TOKEN` is configured. Compare credentials in constant time, require at least 32 characters, authenticate before session lookup, and refuse production startup without the token. Permit tokenless local development.
- **Reasoning:** A scoped server-side shared secret is a small, auditable boundary suitable for the current adapter model and prevents resource enumeration through the mutation route.
- **Consequences:** Deployment secret storage and rotation are required. This does not authenticate hikers or authorize per-user resources; end-user identity remains a separate future decision.

## DEC-023 — Persist session transitions through a compare-and-swap store

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Process-local sessions and events disappear on restart and cannot safely coordinate state writes across multiple API instances.
- **Decision:** Introduce a `SessionStore` interface with PostgreSQL and in-memory implementations. Use `node-postgres`, parameterized queries, and one transaction for each session/event write. Require `DATABASE_URL` in production, retain the in-memory implementation for local development and tests, and reject updates whose expected `state_sequence` is no longer current.
- **Reasoning:** A narrow persistence boundary keeps the HTTP and policy layers independent of the driver, while database compare-and-swap semantics prevent lost updates across processes.
- **Consequences:** Deployments must provision PostgreSQL and apply `001_session_persistence.sql` before API startup. The first migration stores contract-valid JSON payloads beside queryable identity, status, sequence, and time columns. PostGIS-backed normalized route data, migration version tracking, retention policy, and live PostgreSQL integration coverage remain follow-up work.
- **Supersedes:** The process-memory-only consequences recorded in DEC-020 and DEC-021.

## DEC-024 — Initialize sessions from validated live weather when configured

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Session evaluations used only a static environmental fixture even though the product requires current supported inputs and forbids simulated-condition controls.
- **Decision:** Add a server-side Open-Meteo adapter that requests current temperature, 10-meter wind, precipitation probability, day/night status, and daily sunset for cataloged hike coordinates. Make it opt-in through `WEATHER_API_BASE_URL`, support an optional server-only commercial API key, enforce HTTPS and a four-second timeout, validate the response, normalize explicit units, preserve provider/license attribution, and fail closed in production when configuration or a runtime lookup is unavailable while retaining the clearly labeled static fallback outside production.
- **Reasoning:** This creates a real environmental boundary without exposing provider details or controls to the browser, while deterministic fallback keeps local development and transient provider failures usable and honest.
- **Consequences:** New sessions can begin with live attributed conditions. The free Open-Meteo endpoint is suitable only within its terms and call limits; commercial deployment must use an appropriate plan. Development remains usable without network access, while production cannot evaluate a new session from fabricated conditions. Automatic periodic refresh, stored receive time, freshness ceilings, caching, and additional providers remain future work.

## DEC-025 — Gate pull requests with one reproducible CI verification job

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Feature branches were verified locally, but GitHub pull requests had no automated status check to detect platform differences or regressions before merge.
- **Decision:** Run one GitHub Actions job on pull requests targeting `main`, pushes to `main`, and manual dispatch. Use Ubuntu, Node.js 22, `npm ci`, npm cache metadata keyed by the root lockfile, and the repository's test, check, and build scripts. Grant only `contents: read`, disable persisted checkout credentials, cancel superseded runs, set a 15-minute timeout, and pin official actions to reviewed immutable v7 SHAs.
- **Reasoning:** A single sequential job provides an unambiguous branch-protection check while reusing the exact commands contributors run locally. Locked installs and pinned action code reduce environmental and supply-chain drift.
- **Consequences:** Every PR now receives automated verification, at the cost of repeating some contract compilation across existing scripts. Branch protection still needs to be enabled in repository settings after the check name exists. Deployment remains a separate future workflow.
