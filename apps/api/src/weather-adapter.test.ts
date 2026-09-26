import assert from "node:assert/strict";
import test from "node:test";
import {
  OpenMeteoWeatherProvider,
  createWeatherProvider,
} from "./weather-adapter.js";

test("Open-Meteo adapter requests explicit units and normalizes current conditions", async () => {
  let requestedUrl: URL | undefined;
  const provider = new OpenMeteoWeatherProvider({
    baseUrl: "https://api.open-meteo.com/v1/forecast",
    apiKey: "test-commercial-key",
    now: () => new Date("2026-09-25T20:00:02.000Z"),
    fetchImpl: async (input) => {
      requestedUrl = new URL(input.toString());
      return new Response(
        JSON.stringify({
          current: {
            time: "2026-09-25T20:00",
            temperature_2m: 51.4,
            wind_speed_10m: 12.5,
            precipitation_probability: 35,
            is_day: 1,
          },
          daily: { time: ["2026-09-25"], sunset: ["2026-09-25T22:30"] },
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const snapshot = await provider.getCurrent({
    latitude: 42.4898,
    longitude: -71.8976,
  });
  assert.equal(
    requestedUrl?.searchParams.get("temperature_unit"),
    "fahrenheit",
  );
  assert.equal(requestedUrl?.searchParams.get("wind_speed_unit"), "mph");
  assert.equal(requestedUrl?.searchParams.get("timezone"), "UTC");
  assert.equal(requestedUrl?.searchParams.get("apikey"), "test-commercial-key");
  assert.equal(snapshot.observedAt, "2026-09-25T20:00:00.000Z");
  assert.equal(snapshot.receivedAt, "2026-09-25T20:00:02.000Z");
  assert.deepEqual(snapshot.provenance, {
    provider: "Open-Meteo",
    license: "CC BY 4.0",
    attributionUrl: "https://open-meteo.com/",
  });
  assert.deepEqual(snapshot.weather, {
    temperatureF: 51.4,
    windMph: 12.5,
    rainProbability: 0.35,
  });
  assert.deepEqual(snapshot.daylight, {
    sunsetAt: "2026-09-25T22:30:00.000Z",
    remainingMinutes: 150,
  });
});

test("Open-Meteo adapter reports zero remaining daylight overnight", async () => {
  const provider = new OpenMeteoWeatherProvider({
    baseUrl: "https://api.open-meteo.com/v1/forecast",
    fetchImpl: async () =>
      new Response(
        JSON.stringify({
          current: {
            time: "2026-09-26T03:00",
            temperature_2m: 56.9,
            wind_speed_10m: 11.5,
            precipitation_probability: 26,
            is_day: 0,
          },
          daily: { time: ["2026-09-26"], sunset: ["2026-09-26T22:37"] },
        }),
        { status: 200 },
      ),
  });

  const snapshot = await provider.getCurrent({
    latitude: 42.4898,
    longitude: -71.8976,
  });
  assert.equal(snapshot.daylight.remainingMinutes, 0);
});

test("Open-Meteo adapter rejects provider failures and invalid payloads", async () => {
  const unavailable = new OpenMeteoWeatherProvider({
    baseUrl: "https://api.open-meteo.com/v1/forecast",
    fetchImpl: async () => new Response(null, { status: 503 }),
  });
  await assert.rejects(
    () => unavailable.getCurrent({ latitude: 0, longitude: 0 }),
    /returned 503/,
  );

  const malformed = new OpenMeteoWeatherProvider({
    baseUrl: "https://api.open-meteo.com/v1/forecast",
    fetchImpl: async () =>
      new Response(JSON.stringify({ current: {}, daily: {} }), { status: 200 }),
  });
  await assert.rejects(() =>
    malformed.getCurrent({ latitude: 0, longitude: 0 }),
  );
});

test("weather integration is opt-in and rejects insecure remote endpoints", () => {
  assert.equal(createWeatherProvider({}), undefined);
  assert.throws(
    () => createWeatherProvider({ NODE_ENV: "production" }),
    /WEATHER_API_BASE_URL is required/,
  );
  assert.throws(
    () =>
      new OpenMeteoWeatherProvider({
        baseUrl: "http://weather.example.test/forecast",
      }),
    /must use HTTPS/,
  );
});
