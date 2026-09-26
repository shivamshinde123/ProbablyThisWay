import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { latestDecisionSchema } from "@probably-this-way/contracts";
import type { SessionRecord } from "./session-store.js";
import { InMemorySessionStore, createSessionStore } from "./session-store.js";

function makeRecord(): SessionRecord {
  const sessionId = randomUUID();
  const now = "2026-09-25T12:00:00.000Z";
  const state = {
    observedAt: now,
    source: "prototype-static" as const,
    weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
    daylight: { sunsetAt: "2026-09-25T14:39:00.000Z", remainingMinutes: 159 },
    user: { paceMph: 2.1, fatigue: "low" as const },
  };
  const decision = latestDecisionSchema.parse({
    evaluation: {
      id: randomUUID(),
      sessionId,
      status: "completed" as const,
      createdAt: now,
      questionSetVersion: "route-suitability-v1" as const,
      provider: "deterministic-baseline" as const,
      scores: [
        { routeId: "route-a", suitability: 0.8 },
        { routeId: "route-b", suitability: 0.6 },
      ],
    },
    recommendation: {
      routeId: "route-a",
      suitability: 0.8,
      policyVersion: "highest-suitability-v1" as const,
      decidedAt: now,
      explanation: "Route A is preferred.",
      factors: [
        { label: "Weather", value: "Stable" },
        { label: "Daylight", value: "Sufficient" },
      ],
    },
  });
  return {
    session: {
      id: sessionId,
      hikeId: "hike",
      selectedRouteId: "route-a",
      status: "active",
      createdAt: now,
      state,
    },
    decision,
    sequence: 0,
    lastEvaluatedState: state,
    eventSequence: 1,
    events: [
      {
        id: randomUUID(),
        sessionId,
        sequence: 1,
        type: "session_started",
        occurredAt: now,
        state,
        decision,
        crossedThresholds: [],
      },
    ],
  };
}

test("in-memory store returns isolated records and enforces compare-and-swap", async () => {
  const store = new InMemorySessionStore();
  const record = makeRecord();
  await store.create(record);

  assert.deepEqual(await store.listActiveSessionIds(), [record.session.id]);

  const first = await store.get(record.session.id);
  assert.ok(first);
  first.sequence = 1;
  assert.equal((await store.get(record.session.id))?.sequence, 0);
  assert.equal(await store.save(first, 0), true);

  const stale = { ...first, sequence: 2 };
  assert.equal(await store.save(stale, 0), false);
  assert.equal((await store.get(record.session.id))?.sequence, 1);
});

test("production requires a database connection", () => {
  assert.throws(
    () => createSessionStore({ NODE_ENV: "production" }),
    /DATABASE_URL is required/,
  );
});

test("in-memory retention removes only records older than the cutoff", async () => {
  const store = new InMemorySessionStore();
  const old = makeRecord();
  const recent = makeRecord();
  recent.session.createdAt = "2026-10-02T12:00:00.000Z";
  await store.create(old);
  await store.create(recent);

  assert.equal(
    await store.purgeExpired(new Date("2026-10-01T00:00:00.000Z")),
    1,
  );
  assert.equal(await store.get(old.session.id), undefined);
  assert.ok(await store.get(recent.session.id));
});
