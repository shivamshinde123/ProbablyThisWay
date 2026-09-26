# File and Folder Structure

The repository is initialized as `ProbablyThisWay`. The web, API, and shared-contract directories shown below are implemented; later domain and persistence directories remain planned.

```text
/
├── docs/                       # Project specifications and design records
├── apps/
│   ├── web/                    # React/TypeScript client
│   │   └── src/
│   │       ├── components/SessionHud.tsx
│   │       ├── components/TerrainMap.tsx
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── styles.css
│   └── api/                    # Node.js API
│       └── src/
│           ├── app.test.ts
│           ├── app.ts
│           └── server.ts
├── packages/
│   └── contracts/              # Shared Zod schemas and TypeScript types
├── database/
│   ├── migrations/
│   └── seeds/
├── tests/
│   ├── integration/
│   └── e2e/
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── README.md
├── tsconfig.base.json
└── idea.md                     # Original project plan
```

## Rules

- Do not import app infrastructure into `packages/domain`.
- Keep provider-specific code in `integrations`.
- Co-locate unit tests with source; keep cross-system tests under `tests`.
- Add generated artifacts to ignored build directories, not source folders.

npm workspaces manage the monorepo. Add planned domain, database, and test directories only when their implementation begins.

## Phase 6 Additions

- `apps/api/src/policy.ts` — deterministic route recommendation policy.
- `apps/web/src/components/RecommendationBanner.tsx` — current recommendation readout.

## Phase 7 Addition

- `apps/web/public/favicon.svg` — field-instrument browser icon served by Vite.
- `apps/web/vite.config.ts` — uses Vite's filesystem route for Cesium assets in development and copies the same assets under `cesiumStatic` for production builds.

### Automatic Re-evaluation Files

- `apps/api/src/thresholds.ts` — deterministic material-change detector.
- `apps/api/src/thresholds.test.ts` — threshold boundary tests.
- `apps/api/src/app.ts` — ordered state updates and re-evaluation orchestration through `SessionStore`.

### Decision Feed Files

- `apps/web/src/components/DecisionFeed.tsx` — accessible compact decision-event history.
- `apps/web/src/App.tsx` — cursor polling and atomic event application.
- `apps/api/src/app.ts` — durable event append orchestration and cursor endpoint.

### Adapter Authentication Files

- `apps/api/src/adapter-auth.ts` — startup validation and constant-time bearer verification.
- `apps/api/src/adapter-auth.test.ts` — local, configured, weak-token, and production fail-closed tests.

### Persistence Files

- `apps/api/migrations/001_session_persistence.sql` — durable session and decision-event tables, constraints, and index.
- `apps/api/src/session-store.ts` — store contract plus PostgreSQL and in-memory implementations.
- `apps/api/src/session-store.test.ts` — isolation, compare-and-swap, and production configuration tests.
- `apps/api/src/migrate.ts` — migration command entry point.

### Weather Adapter Files

- `apps/api/src/weather-adapter.ts` — validated Open-Meteo normalization and configuration boundary.
- `apps/api/src/weather-adapter.test.ts` — request, normalization, error, and endpoint-security tests.
- `apps/api/src/weather-session.test.ts` — live initialization and explicit fallback integration tests.
- `apps/web/src/components/SessionHud.tsx` — source, observation time, and provider attribution display.
