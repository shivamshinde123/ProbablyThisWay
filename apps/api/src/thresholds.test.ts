import assert from "node:assert/strict";
import { test } from "node:test";
import type { HikingState } from "@probably-this-way/contracts";
import { detectRelevantThresholds } from "./thresholds.js";

const baseline: HikingState = {
  observedAt: "2026-01-01T12:00:00.000Z",
  source: "prototype-static",
  weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
  daylight: { sunsetAt: "2026-01-01T17:00:00.000Z", remainingMinutes: 159 },
  user: { paceMph: 2, fatigue: "low" },
};

test("threshold detector reports each supported material change", () => {
  const current: HikingState = {
    observedAt: "2026-01-01T12:01:00.000Z",
    source: "weather",
    weather: { temperatureF: 64, windMph: 13, rainProbability: 0.33 },
    daylight: { ...baseline.daylight, remainingMinutes: 149 },
    user: { paceMph: 1.7, fatigue: "moderate" },
  };
  assert.deepEqual(detectRelevantThresholds(baseline, current), [
    "temperatureF", "windMph", "rainProbability", "remainingMinutes", "paceMph", "fatigue",
  ]);
});

test("threshold detector ignores changes below every threshold", () => {
  const current: HikingState = {
    observedAt: "2026-01-01T12:01:00.000Z",
    source: "user-input",
    weather: { temperatureF: 63.9, windMph: 12.9, rainProbability: 0.329 },
    daylight: { ...baseline.daylight, remainingMinutes: 150 },
    user: { paceMph: 1.71, fatigue: "low" },
  };
  assert.deepEqual(detectRelevantThresholds(baseline, current), []);
});
