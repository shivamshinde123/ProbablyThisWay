import { readFile } from "node:fs/promises";
import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations");

const migrationUrl = new URL("../migrations/001_session_persistence.sql", import.meta.url);
const migration = await readFile(migrationUrl, "utf8");
const pool = new Pool({ connectionString });

try {
  await pool.query(migration);
  console.log("Applied migration 001_session_persistence.sql");
} finally {
  await pool.end();
}
