import { fileURLToPath } from "node:url";
import { loadEnvFile } from "node:process";
import { buildApp } from "./app.js";

if (process.env.LOAD_ENV_FILE !== "false") {
  try {
    loadEnvFile(fileURLToPath(new URL("../../../.env", import.meta.url)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
}

const app = await buildApp();
try {
  await app.listen({
    host: process.env.HOST ?? "127.0.0.1",
    port: Number(process.env.PORT ?? 3001),
  });
} catch (error) {
  app.log.error(error);
  process.exit(1);
}
