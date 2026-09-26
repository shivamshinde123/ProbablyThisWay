import { z } from "zod";

const logLevelSchema = z.enum(["trace", "debug", "info", "warn", "error", "fatal", "silent"]);

function integerSetting(value: string | undefined, fallback: number, name: string, minimum: number, maximum: number) {
  if (value === undefined || value.trim() === "") return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

export function resolveOperationalConfig(env: NodeJS.ProcessEnv = process.env) {
  const configuredOrigins = env.CORS_ALLOWED_ORIGINS?.split(",").map((origin) => origin.trim()).filter(Boolean);
  const legacyOrigin = env.WEB_ORIGIN?.trim();
  const allowedOrigins = configuredOrigins?.length ? configuredOrigins : legacyOrigin ? [legacyOrigin] : ["http://localhost:5173"];
  if (env.NODE_ENV === "production" && !configuredOrigins?.length && !legacyOrigin) {
    throw new Error("CORS_ALLOWED_ORIGINS or WEB_ORIGIN is required when NODE_ENV=production");
  }

  return {
    allowedOrigins,
    logLevel: logLevelSchema.parse(env.LOG_LEVEL?.trim() || "info"),
    rateLimitMax: integerSetting(env.RATE_LIMIT_MAX, 120, "RATE_LIMIT_MAX", 1, 10_000),
    rateLimitWindowMs: integerSetting(env.RATE_LIMIT_WINDOW_MS, 60_000, "RATE_LIMIT_WINDOW_MS", 1_000, 3_600_000),
    eventPageSize: integerSetting(env.EVENT_PAGE_SIZE, 50, "EVENT_PAGE_SIZE", 1, 100),
  };
}
