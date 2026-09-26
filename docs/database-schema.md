# Database Schema

PostgreSQL is the implemented durable store for sessions and decision events. The reviewed route catalog is an immutable generated source snapshot, so this release neither installs nor requires PostGIS.

## Implemented Migrations

`apps/api/migrations/001_session_persistence.sql` creates the durable domain tables:

### `sessions`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `hike_id` | `text` | Current catalog identifier |
| `selected_route_id` | `text` | Selected route identifier |
| status | text | Constrained to active or ended; used by active-session refresh queries |
| `created_at` | `timestamptz` | Session creation time |
| `session_payload` | `jsonb` | Contract-valid current `Session`, including optional environmental freshness status for legacy-row compatibility |
| `last_evaluated_state` | `jsonb` | Baseline for cumulative threshold detection |
| `latest_decision` | `jsonb` | Contract-valid latest evaluation and recommendation |
| `state_sequence` | `integer` | Non-negative optimistic-concurrency version |
| `event_sequence` | `integer` | Non-negative latest decision-event cursor |
| `updated_at` | `timestamptz` | Last successful state write |

### `decision_events`

| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | Primary key |
| `session_id` | `uuid` | FK to `sessions(id)`, cascading on delete |
| `sequence` | `integer` | Positive cursor; unique with `session_id` |
| `event_type` | `text` | `session_started` or `recommendation_updated` |
| `occurred_at` | `timestamptz` | Event time |
| `payload` | `jsonb` | Contract-valid `DecisionEvent` |

An index on `(session_id, occurred_at)` supports chronological event reads. `002_retention_index.sql` adds `sessions_updated_at_idx` for bounded retention sweeps. `003_session_lifecycle.sql` expands the status constraint to active and ended.

### `schema_migrations`

The migration runner bootstraps this table with version, filename, SHA-256 checksum, and application time. It serializes runners with a PostgreSQL advisory lock, skips previously applied files, and fails if an applied file's checksum changes.

## Write Consistency

Session state, environmental status, the latest decision, and new events are written through the same transaction boundary. Status-only freshness checks increment `state_sequence` without incrementing the independent decision-event cursor. Updates use `WHERE state_sequence = expectedSequence`; a mismatch returns an application-level conflict rather than overwriting a concurrent observation. Event uniqueness makes repeated event insertion harmless within a successful state transition.

## Runtime Modes

When `DATABASE_URL` is set, the API uses `PostgresSessionStore`. Production startup fails without that variable. Local development and tests may omit it and use `InMemorySessionStore`, which implements the same compare-and-swap contract but is cleared on restart.

Run `npm run db:migrate -w @probably-this-way/api` before starting an API process. The command discovers ordered migration files, applies only pending versions, and verifies immutable checksums. CI runs the same migrations twice against PostgreSQL 17 to prove first-apply and repeat behavior.

## Geospatial Storage Boundary

Route geometry is versioned with the application and validated at startup. Internet trail discovery is a stateless remote text/geometry lookup and performs no database spatial query. Duplicating search previews or the three evaluated routes in PostGIS would add migration and synchronization risk without a current requirement. A future arbitrary-trail evaluation or live-routing feature must introduce its own reviewed normalized schema and preserve every provenance field.

## Retention

The API deletes a session when its last successful database write is older than `SESSION_RETENTION_DAYS` (30 days by default). The sweep runs every six hours by default. `decision_events` rows are removed by the session foreign key's `ON DELETE CASCADE`. The in-memory development store follows the same age rule. Retention queries use `sessions_updated_at_idx`.

## Route Snapshot Storage

The current authoritative DCR route catalog is a versioned generated source snapshot, not a database fixture. Each route carries its dataset timestamp, source URL, segment IDs, recorded condition, and legal status. Any future move to a spatial database must preserve these provenance fields and is outside the current release.
