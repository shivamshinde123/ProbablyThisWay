import assert from "node:assert/strict";
import test from "node:test";
import { InMemorySessionStore } from "./session-store.js";
import { RetentionSweeper, resolveRetentionConfig } from "./retention.js";

test("retention config provides bounded production defaults", () => {
  assert.deepEqual(resolveRetentionConfig({}), {
    retentionMs: 30 * 86_400_000,
    sweepIntervalMs: 21_600_000,
  });
  assert.throws(() => resolveRetentionConfig({ SESSION_RETENTION_DAYS: "0" }), /SESSION_RETENTION_DAYS/);
  assert.throws(() => resolveRetentionConfig({ RETENTION_SWEEP_INTERVAL_MS: "1000" }), /RETENTION_SWEEP_INTERVAL_MS/);
});

test("retention sweeper calculates an exact cutoff", async () => {
  class RecordingStore extends InMemorySessionStore {
    before?: Date;
    override async purgeExpired(before: Date) {
      this.before = before;
      return 3;
    }
  }
  const store = new RecordingStore();
  const now = Date.parse("2026-09-26T12:00:00.000Z");
  const sweeper = new RetentionSweeper({
    sessionStore: store,
    retentionMs: 30 * 86_400_000,
    sweepIntervalMs: 60_000,
    onError: () => undefined,
    now: () => now,
  });
  assert.equal(await sweeper.sweep(), 3);
  assert.equal(store.before?.toISOString(), "2026-08-27T12:00:00.000Z");
});