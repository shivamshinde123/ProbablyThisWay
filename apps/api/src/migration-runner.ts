import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Pool, type PoolClient } from "pg";

const migrationNamePattern = /^\d{3}_[a-z0-9_]+\.sql$/;
const lockName = "probably-this-way-schema-migrations";

export type MigrationResult = { applied: string[]; skipped: string[] };

export async function runMigrations(
  connectionString: string,
  migrationsDirectory = fileURLToPath(
    new URL("../migrations/", import.meta.url),
  ),
): Promise<MigrationResult> {
  const entries = (await readdir(migrationsDirectory, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && migrationNamePattern.test(entry.name))
    .map((entry) => entry.name)
    .sort();
  const versions = entries.map((name) => name.slice(0, 3));
  if (new Set(versions).size !== versions.length)
    throw new Error("Migration versions must be unique");

  const pool = new Pool({ connectionString });
  const client = await pool.connect();
  try {
    await client.query("SELECT pg_advisory_lock(hashtext($1))", [lockName]);
    await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      filename text NOT NULL UNIQUE,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT NOW()
    )`);
    return await applyPendingMigrations(client, migrationsDirectory, entries);
  } finally {
    await client
      .query("SELECT pg_advisory_unlock(hashtext($1))", [lockName])
      .catch(() => undefined);
    client.release();
    await pool.end();
  }
}

async function applyPendingMigrations(
  client: PoolClient,
  directory: string,
  filenames: string[],
): Promise<MigrationResult> {
  const existing = await client.query<{ version: string; checksum: string }>(
    "SELECT version, checksum FROM schema_migrations",
  );
  const checksums = new Map(
    existing.rows.map((row) => [row.version, row.checksum]),
  );
  const result: MigrationResult = { applied: [], skipped: [] };

  for (const filename of filenames) {
    const version = filename.slice(0, 3);
    const sql = await readFile(join(directory, filename), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const recorded = checksums.get(version);
    if (recorded) {
      if (recorded !== checksum)
        throw new Error(`Applied migration ${filename} has changed`);
      result.skipped.push(filename);
      continue;
    }
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (version, filename, checksum) VALUES ($1, $2, $3)",
      [version, filename, checksum],
    );
    result.applied.push(filename);
  }
  return result;
}
