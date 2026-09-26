import { runMigrations } from "./migration-runner.js";

const connectionString = process.env.DATABASE_URL?.trim();
if (!connectionString) throw new Error("DATABASE_URL is required to run migrations");

const result = await runMigrations(connectionString);
for (const filename of result.applied) console.log(`Applied migration ${filename}`);
for (const filename of result.skipped) console.log(`Skipped applied migration ${filename}`);