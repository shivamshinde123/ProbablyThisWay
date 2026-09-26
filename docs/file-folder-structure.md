# File and Folder Structure

The repository currently contains planning material only. This is the proposed implementation structure.

```text
/
├── docs/                       # Project specifications and design records
├── apps/
│   ├── web/                    # React/TypeScript client
│   │   └── src/
│   │       ├── components/
│   │       ├── features/
│   │       ├── map/
│   │       ├── services/
│   │       └── styles/
│   └── api/                    # Node.js API
│       └── src/
│           ├── routes/
│           ├── application/
│           ├── domain/
│           ├── integrations/
│           └── persistence/
├── packages/
│   ├── contracts/              # Shared API schemas/types
│   ├── domain/                 # Framework-independent domain logic
│   └── config/                 # Shared lint/TypeScript configuration
├── database/
│   ├── migrations/
│   └── seeds/
├── tests/
│   ├── integration/
│   └── e2e/
├── .env.example
└── idea.md                     # Original project plan
```

## Rules

- Do not import app infrastructure into `packages/domain`.
- Keep provider-specific code in `integrations`.
- Co-locate unit tests with source; keep cross-system tests under `tests`.
- Add generated artifacts to ignored build directories, not source folders.

The monorepo tool and exact package layout are TBD.
