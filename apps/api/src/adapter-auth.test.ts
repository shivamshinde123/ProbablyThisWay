import assert from "node:assert/strict";
import { test } from "node:test";
import {
  isAuthorizedAdapter,
  resolveAdapterAuthConfig,
} from "./adapter-auth.js";

const token = "a-secure-adapter-token-with-32-chars";

test("adapter auth permits tokenless local development", () => {
  const config = resolveAdapterAuthConfig({ NODE_ENV: "development" });
  assert.equal(isAuthorizedAdapter(undefined, config), true);
});

test("adapter auth requires a configured bearer token", () => {
  const config = resolveAdapterAuthConfig({
    NODE_ENV: "development",
    STATE_ADAPTER_TOKEN: token,
  });
  assert.equal(isAuthorizedAdapter(undefined, config), false);
  assert.equal(isAuthorizedAdapter("Bearer wrong-token", config), false);
  assert.equal(isAuthorizedAdapter("bearer " + token, config), true);
});

test("adapter auth rejects weak configured credentials", () => {
  assert.throws(
    () =>
      resolveAdapterAuthConfig({
        NODE_ENV: "development",
        STATE_ADAPTER_TOKEN: "too-short",
      }),
    /at least 32 characters/,
  );
});

test("adapter auth fails closed when production has no credential", () => {
  assert.throws(
    () => resolveAdapterAuthConfig({ NODE_ENV: "production" }),
    /required when NODE_ENV=production/,
  );
});
