import assert from "node:assert/strict";
import test from "node:test";
import { resolveOperationalConfig } from "./operational-config.js";

test("operational config resolves multiple origins and bounded defaults", () => {
  const config = resolveOperationalConfig({
    CORS_ALLOWED_ORIGINS: "https://app.example.com, https://preview.example.com",
    LOG_LEVEL: "warn",
  });
  assert.deepEqual(config.allowedOrigins, ["https://app.example.com", "https://preview.example.com"]);
  assert.equal(config.logLevel, "warn");
  assert.equal(config.rateLimitMax, 120);
  assert.equal(config.rateLimitWindowMs, 60_000);
  assert.equal(config.eventPageSize, 50);
});

test("operational config validates production CORS and numeric bounds", () => {
  assert.throws(() => resolveOperationalConfig({ NODE_ENV: "production" }), /CORS_ALLOWED_ORIGINS or WEB_ORIGIN is required/);
  assert.throws(() => resolveOperationalConfig({ RATE_LIMIT_MAX: "0" }), /RATE_LIMIT_MAX/);
  assert.throws(() => resolveOperationalConfig({ EVENT_PAGE_SIZE: "101" }), /EVENT_PAGE_SIZE/);
});