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

- **Status:** Superseded by DEC-041
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

- **Status:** Superseded by DEC-043
- **Date:** 2026-09-25
- **Context:** Jev is a hosted decision service requiring credentials, while contributors and automated tests need a functional local path.
- **Decision:** Send the normalized state and one typed Noul question per valid route from the API when `JEV_API_KEY` is configured. Validate the response and fall back after four seconds or any invalid response to a deterministic, locally calculated score labeled `deterministic-baseline`.
- **Reasoning:** This preserves the real integration boundary without exposing credentials to the browser or falsely presenting local arithmetic as Jev output.
- **Consequences:** Local scores are suitable for development only. Provider provenance must remain visible, and production deployment requires a Jev key plus contract verification against the configured endpoint.

## DEC-018 — Rank by suitability with stable route-order ties

- **Status:** Superseded
- **Date:** 2026-09-25
- **Context:** Phase 6 needs an auditable recommendation from model-produced route scores, while current route data has no closure or hard-constraint fields.
- **Decision:** Application policy selects the valid route with the highest suitability. Exact ties preserve the validated hike's existing route order. The policy emits a separate typed recommendation using version `highest-suitability-v1`.
- **Reasoning:** A pure deterministic step keeps final control outside Jev, makes outcomes repeatable, and creates a versioned boundary for adding hard constraints later.
- **Consequences:** Signal green denotes the recommendation, orange preserves the user's original choice, and the UI continues to display all scores. The missing closure and restriction override was resolved by DEC-029.
- **Superseded by:** DEC-029.

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
- **Consequences:** Deployments must provision PostgreSQL and apply `001_session_persistence.sql` before API startup. The first migration stores contract-valid JSON payloads beside queryable identity, status, sequence, and time columns. PostGIS-backed normalized route data and retention execution remain follow-up work. Migration tracking and live PostgreSQL coverage are resolved by DEC-032.
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

## DEC-026 — Refresh active-session weather through the shared state transition

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Live weather initialized a session but did not change afterward unless an external adapter pushed state, leaving the automatic re-evaluation MVP requirement incomplete.
- **Decision:** When a weather provider is configured, run one serialized refresh cycle every five minutes by default, with a configurable minimum of one minute. Discover active sessions through the durable store, fetch once per hike per cycle, record provider observation and server receipt times, preserve user state, and apply snapshots through the same stale-check, threshold, event, and compare-and-swap transition as adapter updates. Log provider failures and retain the last valid decision.
- **Reasoning:** A server-owned refresh closes the live-input loop without adding browser controls, while shared transition logic keeps pushed and pulled observations behaviorally identical. Per-hike request deduplication limits provider traffic.
- **Consequences:** Active sessions can now produce automatic recommendation events as weather changes, including after an API restart when PostgreSQL is configured. Each API replica currently runs a refresher; compare-and-swap prevents lost updates, but distributed scheduling/leases, provider-specific freshness ceilings, backoff, and caching remain future operational work.
- **Supersedes:** The automatic-periodic-refresh and stored-receive-time follow-ups in DEC-024.

## DEC-027 — Expose freshness without fabricating decision events

- **Status:** Accepted
- **Date:** 2026-09-25
- **Context:** Automatic refresh retained the last valid recommendation after provider failure, but the active UI could continue presenting those conditions as current. Below-threshold updates also changed durable state without producing a decision event for the client.
- **Decision:** Add typed environmental status with current, stale, and prototype states plus explicit reasons. Use a 30-minute default Open-Meteo observation ceiling, configurable no lower than the provider's 15-minute current-condition timestep and never shorter than the refresh interval. Persist refresh failures through compare-and-swap without appending a recommendation event. Return latest state/status on every event-feed read so the HUD updates even when the event batch is empty.
- **Reasoning:** Freshness is session state, not a decision. Keeping it beside the cursor response preserves the contiguous decision log while making failure and age visible within the existing polling path. A 30-minute ceiling allows two documented provider timesteps before expiry.
- **Consequences:** The HUD clearly distinguishes current, failed/expired, unknown legacy, and prototype conditions while retaining last valid values. Existing persisted sessions remain readable because stored status is optional and derived when absent. Provider-specific ceilings for additional adapters must be defined when those adapters are added.
- **Supersedes:** The provider-specific freshness-ceiling follow-ups in DEC-024 and DEC-026.

## DEC-028 — Snapshot authoritative DCR summit corridors with reproducible provenance

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The map and evaluator used hand-authored preview geometry that could not satisfy the MVP requirement for real trail alternatives.
- **Decision:** Use the Massachusetts DCR Roads and Trails ArcGIS feature layer for Pine Hill, Mountain House, and Harrington summit corridors. Check in a generated WGS84 snapshot assembled from explicit DCR feature IDs, reject missing, discontinuous, or non-legal segments during regeneration, and retain dataset timestamp, source URL, segment IDs, condition, and legal-status provenance in the public contract. Use the official 2019 DCR trail-map distance, ascent, and duration values because the line layer does not carry those corridor-level metrics.
- **Reasoning:** A reproducible local snapshot avoids a runtime dependency while keeping every coordinate traceable to a public agency dataset. Validation prevents accidental route changes from entering the application silently.
- **Consequences:** Geometry is authoritative to the source snapshot but not a live closure feed or navigation guarantee. DCR supplies no exposure rating, so exposure remains explicitly unknown and the deterministic baseline treats it conservatively. Refreshes are intentional through `npm run data:refresh:dcr` and require review of the generated diff.
- **Supersedes:** The preview-geometry plan and launch-trail TBD.

## DEC-029 — Apply route access constraints before suitability ranking

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Suitability scores could select a route even when an authoritative source marked it illegal, closed, restricted, or subject to a prohibitive rule.
- **Decision:** Add typed access status and restrictions to every route. Policy version `hard-constraints-v2` removes illegal, closed, restricted, and prohibitively constrained routes before comparing scores. It returns a typed unavailable decision with audited exclusion reasons when nothing remains. Advisory restrictions remain visible but do not exclude a route. Legacy `highest-suitability-v1` decisions are parsed with backward-compatible defaults.
- **Reasoning:** Official constraints must dominate probabilistic or baseline suitability. A no-route result is safer and more truthful than choosing the highest score from an ineligible set.
- **Consequences:** The UI disables known-ineligible routes, suppresses map recommendation highlighting when no route is eligible, and presents exclusion reasons assertively. The current DCR geometry snapshot does not provide live operating status, so its routes remain explicitly `unknown`; users are directed to current notices until an advisory adapter supplies newer status.
- **Supersedes:** The missing closure/restriction override noted in DEC-018.

## DEC-030 — Gate pull requests with desktop and mobile browser flows

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Unit, contract, type, and build checks did not prove that the API, Vite client, Cesium shell, and responsive interaction flow worked together in a browser.
- **Decision:** Add Playwright with pinned Chromium coverage for desktop Chrome and Pixel 7 viewports. Start the real local API and Vite servers, exercise authoritative route loading, route selection, session creation, recommendation rendering, responsive stacking, stale-environmental warnings, and absence of a simulation control. Retain traces, screenshots, video, and an HTML report only as ignored artifacts. Install Chromium and run the suite in the existing pull-request CI job.
- **Reasoning:** The tests cover the product story at the user boundary while keeping one required CI signal and reproducible local commands.
- **Consequences:** CI takes longer and downloads a browser runtime. Failures retain diagnostic artifacts under `output/playwright/`; the suite uses local prototype weather and does not require secrets.
- **Supersedes:** The missing-browser-coverage follow-up in the technical design.

## DEC-031 — Add bounded API operational guardrails

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The API used one development CORS origin, fixed logging, unbounded event responses, and no traffic or dependency-health controls.
- **Decision:** Validate configurable structured-log levels and CORS allowlists; apply the security-fixed `@fastify/rate-limit` 11.2.0 plugin to non-health routes; cap event pages at 100; and expose separate process liveness and store-backed readiness routes.
- **Reasoning:** These controls make a single API instance safer to deploy and give an orchestrator truthful probes without requiring a hosting provider or secrets.
- **Consequences:** Rate counters remain process-local and must move to a shared store before horizontal scaling. Production must declare at least one browser origin. Existing `/api/v1/health` remains compatible.

## DEC-032 — Track immutable migrations and verify them against PostgreSQL

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The migration command executed one hard-coded file and CI never exercised PostgreSQL, leaving upgrade ordering and driver/SQL behavior unverified.
- **Decision:** Discover ordered `NNN_name.sql` files, serialize runners with a PostgreSQL advisory lock, record version/filename/SHA-256 checksum in `schema_migrations`, reject changed applied files, and run first-apply plus no-op-repeat integration coverage against the pinned PostgreSQL 17.11 service in CI.
- **Reasoning:** Explicit immutable history and a real database check make deploy-time schema changes repeatable without introducing an ORM.
- **Consequences:** Migration files are append-only after application. Local PostgreSQL integration tests skip when `TEST_DATABASE_URL` is absent; CI always runs them. Migration `002` adds the index required for a later retention sweep.
- **Supersedes:** The migration-version-tracking and live-PostgreSQL-testing follow-ups in DEC-023.

## DEC-033 — Retain inactive session data for 30 days

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Durable session snapshots and decision events previously had no deletion policy.
- **Decision:** Delete sessions whose last successful write is older than 30 days by default, sweep every six hours, and cascade deletion to their decision events. Allow bounded environment overrides from 1-365 days and 1 minute-24 hours.
- **Reasoning:** The MVP needs short-lived operational continuity, not indefinite behavioral history. Using the last write protects active sessions while limiting stored state.
- **Consequences:** Expired session URLs return not found and cannot be restored by the application. Every API replica may sweep safely because deletion is idempotent. Personal GPS history remains out of scope.
- **Supersedes:** The retention-policy follow-ups in DEC-020, DEC-023, and the technical design.

## DEC-034 — Ship provider-neutral production containers

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Production artifacts existed, but there was no reproducible runtime topology, migration gate, reverse proxy, or deploy-time image verification.
- **Decision:** Build pinned Node/Alpine API and web-builder stages, serve the web bundle through pinned Nginx, proxy same-origin `/api` traffic, and provide Compose orchestration for PostgreSQL, one-shot migrations, API readiness, and web startup. Build both images in pull-request CI.
- **Reasoning:** Containers make the tested runtime portable without prematurely selecting a cloud provider, registry, DNS service, or secret manager.
- **Consequences:** Operators must inject required credentials, terminate TLS, manage backups, and translate the topology to their platform. The shipped single-instance process-local rate limit and refresh scheduler require shared coordination before horizontal scaling.

## DEC-035 — Enforce automated source quality

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Type checking and tests were automated, but formatting and lint rules were still unspecified.
- **Decision:** Pin ESLint 10, TypeScript ESLint, React Hooks, React Refresh, and Prettier 3 at the workspace root. Run `npm run quality` in pull-request CI and exclude generated route geometry from mechanical source checks.
- **Reasoning:** A reproducible code-quality gate catches JavaScript, TypeScript, and React correctness issues while keeping generated authoritative data byte-stable.
- **Consequences:** Supported source and configuration files are normalized once and all later pull requests must pass lint and formatting checks in addition to tests, types, builds, containers, and browser flows.
- **Supersedes:** The unspecified lint/format tooling in the coding conventions.

## DEC-036 — Close the MVP release boundary

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Several documents still described optional scaling or roadmap ideas as unresolved implementation work, creating contradictions with the completed single-instance MVP.
- **Decision:** Support one API replica with synchronous bounded evaluation, anonymous capability sessions, cursor polling, an immutable reviewed route snapshot, deterministic questions/explanations, and PostgreSQL session/event persistence. Do not require an LLM, queue, PostGIS, account system, streaming transport, or distributed coordination for this release. Define initial availability, latency, backup, recovery, retention, and alert targets in the deployment runbook. Require the complete CI signal, current-base checks, review, conversation resolution, and linear history on `main`.
- **Reasoning:** These boundaries satisfy every MVP acceptance criterion without pretending that multi-instance scale, personal accounts, or broad spatial search are already product requirements.
- **Consequences:** Cloud products and secrets remain operator inputs. Any horizontal scaling, personal data, accounts, broad-catalog search, or server push is a separately scoped feature with its own security, privacy, storage, and operational design.
- **Supersedes:** Unresolved MVP wording for an evaluation endpoint, LLM provider, PostGIS migration, end-user authentication, queue, distributed limiter/scheduler, streaming, breakpoints, and operational targets.

## DEC-037 — Search only reviewed supported trails

- **Status:** Superseded by DEC-039
- **Date:** 2026-09-26
- **Context:** The catalog loaded a default route with no visible search affordance, which made the product appear fixed and made its actual coverage unclear.
- **Decision:** Add a prominent search form over the loaded hike and route names/location, return accessible route results, and state the exact three-trail Wachusett boundary on no match. Lock search during an active session. Do not query arbitrary trails until a reviewed ingestion and alternative-route pipeline exists.
- **Reasoning:** Search is useful only when its results can enter the same authoritative evaluation contract. A clear supported-catalog search is more honest than returning worldwide names that cannot start a valid session.
- **Consequences:** Users can quickly select any currently supported trail. Expanding geographic coverage remains a data-ingestion feature, not a UI-only change.

## DEC-038 — Make session ending explicit, persistent, and idempotent

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Starting a field session locked search and route controls with no user-visible way to leave the active state.
- **Decision:** Add a visible end-session action backed by an idempotent API transition from active to ended, persist endedAt, and exclude ended sessions from state adapters and automatic weather refresh. Keep ended records under the existing retention policy.
- **Reasoning:** A UI-only reset would leave server work running and create inconsistent state. A persisted lifecycle transition gives the user a reliable stop control and lets every writer enforce the same boundary.
- **Consequences:** Ending clears the client’s live-session surfaces and unlocks search without deleting history. Restarting creates a new session ID. Concurrent writes resolve through the existing compare-and-swap sequence.

## DEC-039 — Add internet trail discovery without implying evaluation coverage

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Searching only the three reviewed Wachusett routes did not meet the user’s need to find named trails beyond the launch catalog.
- **Decision:** Query OpenStreetMap through a server-side Nominatim adapter on explicit form submission, return attributed line geometry, and preview selected results in Cesium. Enforce the public service policy with identification, visible attribution, a serialized rate above one second, duplicate-query caching, and a configurable provider URL. Keep arbitrary internet results outside session evaluation until reviewed alternatives, restrictions, metrics, and provenance exist.
- **Reasoning:** Nominatim provides broad name/location discovery and real geometry without an API key. Separating preview from evaluated routes expands useful coverage without fabricating safety or recommendation data.
- **Consequences:** Search coverage follows OpenStreetMap naming and Nominatim indexing and cannot guarantee every physical trail. Public-service capacity is suitable for the current single-instance prototype; production growth should use a contracted or self-hosted compatible provider. DEC-037’s reviewed-only search boundary is superseded, while its requirement not to misrepresent evaluation coverage remains.

## DEC-040 — Raise the interface typography floor

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The field-instrument aesthetic used 7-10 px labels and metadata that were visibly too small for comfortable reading.
- **Decision:** Set an 11 px minimum for secondary labels, 13 px minimum for key interactive/search and route metadata, 14-17 px body copy, and larger supporting headings while retaining the established visual hierarchy.
- **Reasoning:** Readability is a functional requirement. The design can preserve its technical character through spacing, capitalization, color, and typography choice without relying on tiny text.
- **Consequences:** Panels and result rows may become taller, especially on mobile. Browser coverage asserts key computed font sizes so future styling does not silently regress.

## DEC-041 — Use public global elevation terrain by default

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The tokenless map rendered a flat ellipsoid, so users could not see the 3D terrain promised by the product.
- **Decision:** Use Cesium’s ArcGISTiledElevationTerrainProvider with the public ArcGIS World Elevation Terrain3D ImageServer when no ion token is configured. Preserve Cesium World Terrain as the token-based option, clamp all route visuals to terrain, enable lighting/depth testing after readiness, and show provider credits.
- **Reasoning:** The public elevation service supplies real global height tiles without requiring the user to add a secret, while the existing token path remains available for teams that prefer Cesium World Terrain.
- **Consequences:** The browser requires network access to the public elevation service. Provider failure degrades visibly to an ellipsoid and does not affect route evaluation, whose ascent values still come from reviewed trail metrics. Attribution must remain visible.
- **Supersedes:** DEC-013’s tokenless ellipsoid fallback.

## DEC-042 — Make the Open-Meteo credential contract explicit

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The generic weather variable names did not tell operators which provider key was compatible or that the public provider is keyless.
- **Decision:** Identify Open-Meteo as the sole implemented weather provider in both environment templates. Document the keyless public Forecast API as the default and require the Open-Meteo customer endpoint whenever a paid Customer API key is supplied.
- **Reasoning:** Provider-specific instructions prevent users from purchasing or pasting an incompatible OpenWeatherMap or WeatherAPI credential and keep the free local setup simple.
- **Consequences:** WEATHER_API_KEY remains backward-compatible but accepts only an Open-Meteo Customer API key. Commercial deployments must change both the endpoint and the key; free/non-commercial deployments leave the key empty.

## DEC-043 — Replace the hosted Jev adapter with OpenRouter

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** The user chose OpenRouter for hosted route evaluation, but an OpenRouter key is not compatible with Jev's custom endpoint, Noul request format, or response shape.
- **Decision:** Replace the Jev network adapter and environment variables with an OpenRouter Chat Completions adapter. Request strict JSON-schema output for every reviewed route, validate route membership and scores again in application code, record provider `openrouter`, and retain the labeled deterministic baseline on missing credentials or any provider failure. Default model routing to `openrouter/auto` while allowing an explicit `OPENROUTER_MODEL`.
- **Reasoning:** A provider-native adapter prevents sending incompatible payloads, keeps the API key server-side, allows model choice without code changes, and preserves the deterministic safety/policy boundary.
- **Consequences:** Operators create a key at `https://openrouter.ai/settings/keys` and set `OPENROUTER_API_KEY`. OpenRouter/model usage may incur cost and variable latency. The model supplies scores only; hard constraints and final route selection remain deterministic application code.
- **Supersedes:** DEC-017's hosted Jev adapter. Earlier Jev references in this chronological log describe superseded design history.

## DEC-044 — Resolve named places to nearby paths and make terrain relief explicit

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Exact searches such as Newton Hill resolved to a point and were discarded by the line-only adapter. The terrain provider was active, but a uniform surface and steep camera made the map look flat.
- **Decision:** Preserve normalized queries, return direct trail lines when available, and otherwise use a tightly bounded OpenStreetMap map extract around the matched place to return a clearly labeled nearby trail network and named paths. Exclude private and sidewalk/crossing geometry, retry dense areas with a smaller window, and keep the results preview-only. Add 1.8× vertical exaggeration, shallow oblique framing, and a visible Frame 3D terrain control.
- **Reasoning:** People commonly search by a hill, reservation, or park name while OSM stores its trails as separate ways. A bounded fallback bridges those data shapes without pretending the paths are reviewed routes. Explicit visual relief and controls make the existing elevation data understandable.
- **Consequences:** Search now finds Newton Hill and other Worcester places with nearby OSM paths, including unnamed segments under a transparent place-based label. Results still depend on OSM coverage. The map deliberately exaggerates rendered relief for legibility; evaluation continues to use reviewed ascent metrics, not visual tile height. Cesium static assets are copied with an explicit Windows-safe path strip so production requests resolve under /cesiumStatic instead of receiving undecodable fallback HTML.
- **Refines:** DEC-039 and DEC-041.

## DEC-045 — Make trail selection search-first and evaluate selected internet geometry

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** Automatically displaying three Wachusett examples made the application look fixed. Internet results could only be previewed, so Start stayed disabled, OpenRouter never ran, and no model response or chosen route appeared. Cesium also framed zero-height coordinates inside depth-tested terrain, producing a blank view after Frame 3D terrain.
- **Decision:** Start with no selected hike or visible example route list. Let the user search, select, and explicitly start either reviewed or attributed OpenStreetMap geometry. Convert a LineString to one session candidate and up to the eight longest MultiLineString branches to candidates; preserve unknown access, legality, exposure, condition, and elevation. Persist and return the exact generated hike. Show structured provider/fallback scores in a clearly labeled model-response panel and let deterministic policy make the final choice. Frame Cesium above sampled terrain at a conservative oblique range, place the focused-trail caption in the upper map region, and make the right control panel collapsible.
- **Reasoning:** This aligns the visible product with the requested search-first workflow while retaining the boundary between model scoring and application policy. Unknown source facts remain honest instead of being fabricated. A terrain-surface target prevents the camera from looking into the globe.
- **Consequences:** Arbitrary search results can now enter an evaluated session, but they are not authoritative navigation or closure data. A single-line result has one score; a trail network exposes up to eight separately named branch scores. The panel can release map space without losing an accessible expand control. PostgreSQL needs no migration because generated hike details live in the existing JSON session payload.
- **Supersedes:** DEC-039's preview-only evaluation boundary and DEC-044's preview-only consequence. Historical text remains for chronology.
- **Refines:** DEC-043 by applying its structured-score contract to validated search-derived candidates as well as reviewed routes.

## DEC-046 — Animate the recommended route without claiming live tracking

- **Status:** Accepted
- **Date:** 2026-09-26
- **Context:** A static recommendation line showed which path policy chose but did not visually communicate travel from its start to its endpoint. Live GPS remains outside the MVP.
- **Decision:** Automatically run a 16-second, distance-weighted browser preview over the recommended geometry. Move a directional pointer with a pulsing halo, illuminate the completed segment, show an accessible percentage, and provide pause, resume, play-again, and restart controls. Honor reduced-motion preference and label the surface `Animated guide · not live GPS`.
- **Reasoning:** Motion makes route direction and extent immediately legible while explicit labeling and local-only playback prevent the visualization from being mistaken for measured user progress.
- **Consequences:** Playback state is ephemeral and never affects session state, evaluation, or policy. Recommendation/viewer changes must cancel animation frames and clean up Cesium entities. Actual hike progress still requires a future consented location source.
- **Refines:** DEC-007 by distinguishing an illustrative route preview from prohibited fabricated live progress.
