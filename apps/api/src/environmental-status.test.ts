import assert from "node:assert/strict";
import test from "node:test";
import type { HikingState } from "@probably-this-way/contracts";
import {
  DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS,
  currentEnvironmentalStatus,
  failedEnvironmentalStatus,
  resolveEnvironmentalStatus,
  resolveWeatherFreshnessMaxAge,
} from "./environmental-status.js";

const weatherState: HikingState = {
  observedAt: "2026-09-25T20:00:00.000Z",
  receivedAt: "2026-09-25T20:00:02.000Z",
  source: "weather",
  provenance: {
    provider: "Open-Meteo",
    license: "CC BY 4.0",
    attributionUrl: "https://open-meteo.com/",
  },
  weather: { temperatureF: 51, windMph: 8, rainProbability: 0.2 },
  daylight: { sunsetAt: "2026-09-25T22:30:00.000Z", remainingMinutes: 150 },
  user: { paceMph: 2.1, fatigue: "low" },
};

test("environmental status expires at the configured observation ceiling", () => {
  const current = currentEnvironmentalStatus(weatherState, 30 * 60_000);
  assert.equal(current.checkedAt, weatherState.receivedAt);
  assert.equal(current.staleAfter, "2026-09-25T20:30:00.000Z");
  assert.equal(
    resolveEnvironmentalStatus(
      current,
      weatherState,
      30 * 60_000,
      new Date("2026-09-25T20:29:59.000Z"),
    ).status,
    "current",
  );
  const expired = resolveEnvironmentalStatus(
    current,
    weatherState,
    30 * 60_000,
    new Date("2026-09-25T20:30:00.000Z"),
  );
  assert.equal(expired.status, "stale");
  assert.equal(expired.reason, "observation_expired");
});

test("refresh failure marks the last valid observation stale", () => {
  const current = currentEnvironmentalStatus(weatherState, 30 * 60_000);
  const failed = failedEnvironmentalStatus(current, "2026-09-25T20:05:00.000Z");
  assert.equal(failed.status, "stale");
  assert.equal(failed.reason, "refresh_failed");
  assert.equal(failed.staleAfter, current.staleAfter);
});

test("freshness configuration respects provider resolution and refresh cadence", () => {
  assert.equal(
    resolveWeatherFreshnessMaxAge({}, 5 * 60_000),
    DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS,
  );
  assert.equal(
    resolveWeatherFreshnessMaxAge(
      { WEATHER_FRESHNESS_MAX_AGE_MS: "900000" },
      60_000,
    ),
    900_000,
  );
  assert.throws(
    () =>
      resolveWeatherFreshnessMaxAge({ WEATHER_FRESHNESS_MAX_AGE_MS: "899999" }),
    /at least 900000/,
  );
  assert.throws(
    () =>
      resolveWeatherFreshnessMaxAge(
        { WEATHER_FRESHNESS_MAX_AGE_MS: "1800000" },
        3_600_000,
      ),
    /greater than or equal/,
  );
});
