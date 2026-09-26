import assert from "node:assert/strict";
import test from "node:test";
import { decisionEventsResponseSchema, hikeDetailSchema, sessionStartResponseSchema } from "@probably-this-way/contracts";
import { buildApp } from "./app.js";
import { InMemorySessionStore } from "./session-store.js";
import { failedEnvironmentalStatus } from "./environmental-status.js";
import { transitionSessionState, updateEnvironmentalStatus } from "./session-state.js";
import type { WeatherProvider } from "./weather-adapter.js";
import {
  DEFAULT_WEATHER_REFRESH_INTERVAL_MS,
  WeatherRefresher,
  resolveWeatherRefreshInterval,
} from "./weather-refresh.js";

test("weather refresh fetches once per hike and re-evaluates active sessions", async () => {
  const sessionStore = new InMemorySessionStore();
  const initialProvider: WeatherProvider = {
    async getCurrent() {
      return {
        observedAt: "2026-09-25T20:00:00.000Z",
        receivedAt: "2026-09-25T20:00:01.000Z",
        source: "weather",
        provenance: { provider: "Open-Meteo", license: "CC BY 4.0", attributionUrl: "https://open-meteo.com/" },
        weather: { temperatureF: 51, windMph: 8, rainProbability: 0.2 },
        daylight: { sunsetAt: "2026-09-25T22:30:00.000Z", remainingMinutes: 150 },
      };
    },
  };
  const app = await buildApp({ sessionStore, weatherProvider: initialProvider });
  const createSession = async () => {
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" },
    });
    return sessionStartResponseSchema.parse(response.json()).session;
  };
  const first = await createSession();
  const second = await createSession();
  const hikeResponse = await app.inject({ method: "GET", url: "/api/v1/hikes/wachusett-summit" });
  const hike = hikeDetailSchema.parse(hikeResponse.json());

  let providerCalls = 0;
  const refreshProvider: WeatherProvider = {
    async getCurrent() {
      providerCalls += 1;
      return {
        observedAt: "2026-09-25T20:05:00.000Z",
        receivedAt: "2026-09-25T20:05:01.000Z",
        source: "weather",
        provenance: { provider: "Open-Meteo", license: "CC BY 4.0", attributionUrl: "https://open-meteo.com/" },
        weather: { temperatureF: 51, windMph: 14, rainProbability: 0.2 },
        daylight: { sunsetAt: "2026-09-25T22:30:00.000Z", remainingMinutes: 145 },
      };
    },
  };
  const refresher = new WeatherRefresher({
    sessionStore,
    weatherProvider: refreshProvider,
    locations: { "wachusett-summit": { latitude: 42.4898, longitude: -71.8976 } },
    intervalMs: 60_000,
    applySnapshot: async (record, nextState) => (
      await transitionSessionState({ record, nextState, hike, sessionStore })
    ).status,
  });

  await refresher.refreshNow();

  assert.equal(providerCalls, 1);
  for (const session of [first, second]) {
    const record = await sessionStore.get(session.id);
    assert.ok(record);
    assert.equal(record.sequence, 1);
    assert.equal(record.eventSequence, 2);
    assert.equal(record.session.state.weather.windMph, 14);
    assert.equal(record.session.state.receivedAt, "2026-09-25T20:05:01.000Z");
    assert.deepEqual(record.events[1]?.crossedThresholds, ["windMph"]);
  }

  const failingRefresher = new WeatherRefresher({
    sessionStore,
    weatherProvider: { async getCurrent() { throw new Error("provider unavailable"); } },
    locations: { "wachusett-summit": { latitude: 42.4898, longitude: -71.8976 } },
    intervalMs: 60_000,
    applySnapshot: async () => "accepted",
    onSessionError: async (record) => {
      const environmentalStatus = failedEnvironmentalStatus(
        record.session.environmentalStatus,
        "2026-09-25T20:10:00.000Z",
      );
      const result = await updateEnvironmentalStatus({ record, environmentalStatus, sessionStore });
      assert.equal(result, "accepted");
    },
  });
  await failingRefresher.refreshNow();

  for (const session of [first, second]) {
    const record = await sessionStore.get(session.id);
    assert.ok(record);
    assert.equal(record.sequence, 2);
    assert.equal(record.eventSequence, 2);
    assert.equal(record.session.environmentalStatus?.status, "stale");
    assert.equal(record.session.environmentalStatus?.reason, "refresh_failed");
  }
  const statusResponse = await app.inject({
    method: "GET",
    url: "/api/v1/sessions/" + first.id + "/events?after=2",
  });
  const status = decisionEventsResponseSchema.parse(statusResponse.json());
  assert.deepEqual(status.items, []);
  assert.equal(status.environmentalStatus.status, "stale");
  assert.equal(status.environmentalStatus.reason, "refresh_failed");
  assert.equal(status.state.weather.windMph, 14);
  await app.close();
});

test("weather refresh interval has a safe default and rejects rapid polling", () => {
  assert.equal(resolveWeatherRefreshInterval({}), DEFAULT_WEATHER_REFRESH_INTERVAL_MS);
  assert.equal(resolveWeatherRefreshInterval({ WEATHER_REFRESH_INTERVAL_MS: "60000" }), 60_000);
  assert.throws(
    () => resolveWeatherRefreshInterval({ WEATHER_REFRESH_INTERVAL_MS: "59999" }),
    /at least 60000/,
  );
});
