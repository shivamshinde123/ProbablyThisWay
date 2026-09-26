# File and Folder Structure

The repository is initialized as `ProbablyThisWay`. The web, API, and shared-contract directories shown below are implemented; later domain and persistence directories remain planned.

```text
/
├── docs/                       # Project specifications and design records
├── apps/
│   ├── web/                    # React/TypeScript client
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       └── styles.css
│   └── api/                    # Node.js API
│       └── src/
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
