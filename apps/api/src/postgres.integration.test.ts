import assert from "node:assert/strict";
import test from "node:test";
import { Pool } from "pg";
import { runMigrations } from "./migration-runner.js";
import { PostgresSessionStore } from "./session-store.js";

const connectionString = process.env.TEST_DATABASE_URL?.trim();

test("PostgreSQL migrations are tracked, repeatable, and complete", { skip: !connectionString }, async () => {
  if (!connectionString) return;
  const pool = new Pool({ connectionString });
  try {
    await pool.query("DROP SCHEMA public CASCADE; CREATE SCHEMA public");
    const first = await runMigrations(connectionString);
    assert.deepEqual(first.applied, ["001_session_persistence.sql", "002_retention_index.sql"]);
    assert.deepEqual(first.skipped, []);

    const second = await runMigrations(connectionString);
    assert.deepEqual(second.applied, []);
    assert.deepEqual(second.skipped, ["001_session_persistence.sql", "002_retention_index.sql"]);

    const migrations = await pool.query<{ version: string }>("SELECT version FROM schema_migrations ORDER BY version");
    assert.deepEqual(migrations.rows.map((row) => row.version), ["001", "002"]);
    const index = await pool.query<{ exists: boolean }>(
      "SELECT to_regclass('public.sessions_updated_at_idx') IS NOT NULL AS exists",
    );
    assert.equal(index.rows[0]?.exists, true);

    const sessionId = "00000000-0000-4000-8000-000000000001";
    await pool.query(
      `INSERT INTO sessions (
        id, hike_id, selected_route_id, status, created_at, session_payload,
        last_evaluated_state, latest_decision, state_sequence, event_sequence, updated_at
      ) VALUES ($1, 'hike', 'route', 'active', NOW() - INTERVAL '40 days', '{}'::jsonb,
        '{}'::jsonb, '{}'::jsonb, 0, 1, NOW() - INTERVAL '40 days')`,
      [sessionId],
    );
    await pool.query(
      `INSERT INTO decision_events (id, session_id, sequence, event_type, occurred_at, payload)
       VALUES ('00000000-0000-4000-8000-000000000002', $1, 1, 'session_started', NOW() - INTERVAL '40 days', '{}'::jsonb)`,
      [sessionId],
    );
    const store = new PostgresSessionStore({ connectionString });
    assert.equal(await store.purgeExpired(new Date(Date.now() - 30 * 86_400_000)), 1);
    const remaining = await pool.query<{ count: number }>(
      "SELECT COUNT(*)::int AS count FROM decision_events WHERE session_id = $1",
      [sessionId],
    );
    assert.equal(remaining.rows[0]?.count, 0);
    await store.close();
  } finally {
    await pool.end();
  }
});