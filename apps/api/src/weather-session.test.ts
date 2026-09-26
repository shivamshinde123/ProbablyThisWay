import assert from "node:assert/strict";
import test from "node:test";
import { sessionStartResponseSchema } from "@probably-this-way/contracts";
import { buildApp } from "./app.js";
import type { WeatherProvider } from "./weather-adapter.js";

test("session creation uses a configured live environmental snapshot", async () => {
  let requestedLocation: { latitude: number; longitude: number } | undefined;
  const provider: WeatherProvider = {
    async getCurrent(location) {
      requestedLocation = location;
      return {
        observedAt: "2026-09-25T20:00:00.000Z",
        receivedAt: "2026-09-25T20:00:01.000Z",
        source: "weather",
        provenance: { provider: "Open-Meteo", license: "CC BY 4.0", attributionUrl: "https://open-meteo.com/" },
        weather: { temperatureF: 51.4, windMph: 12.5, rainProbability: 0.35 },
        daylight: { sunsetAt: "2026-09-25T22:30:00.000Z", remainingMinutes: 150 },
      };
    },
  };
  const app = await buildApp({ weatherProvider: provider });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { hikeId: "wachusett-summit", selectedRouteId: "mountain-house-summit" },
  });

  assert.equal(response.statusCode, 201);
  const body = sessionStartResponseSchema.parse(response.json());
  assert.deepEqual(requestedLocation, { latitude: 42.4889, longitude: -71.8868 });
  assert.equal(body.session.state.source, "weather");
  assert.equal(body.session.environmentalStatus?.status, "current");
  assert.equal(body.session.state.receivedAt, "2026-09-25T20:00:01.000Z");
  assert.equal(body.session.state.provenance?.provider, "Open-Meteo");
  assert.deepEqual(body.session.state.weather, { temperatureF: 51.4, windMph: 12.5, rainProbability: 0.35 });
  assert.equal(body.session.state.user.fatigue, "low");
  await app.close();
});

test("session creation falls back explicitly when weather is unavailable", async () => {
  const provider: WeatherProvider = {
    async getCurrent() {
      throw new Error("provider unavailable");
    },
  };
  const app = await buildApp({ weatherProvider: provider });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { hikeId: "wachusett-summit", selectedRouteId: "mountain-house-summit" },
  });

  assert.equal(response.statusCode, 201);
  const body = sessionStartResponseSchema.parse(response.json());
  assert.equal(body.session.state.source, "prototype-static");
  assert.equal(body.session.state.daylight.remainingMinutes, 159);
  await app.close();
});

test("session creation fails closed when production weather is unavailable", async () => {
  const provider: WeatherProvider = {
    async getCurrent() {
      throw new Error("provider unavailable");
    },
  };
  const app = await buildApp({ weatherEnv: { NODE_ENV: "production" }, weatherProvider: provider });
  const response = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { hikeId: "wachusett-summit", selectedRouteId: "mountain-house-summit" },
  });

  assert.equal(response.statusCode, 503);
  assert.equal(response.json().error.code, "weather_unavailable");
  await app.close();
});
