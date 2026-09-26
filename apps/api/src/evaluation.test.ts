import assert from "node:assert/strict";
import { test } from "node:test";
import type { HikingState } from "@probably-this-way/contracts";
import { evaluateRoutes, evaluateWithOpenRouter } from "./evaluation.js";
import { hikeDetails } from "./route-catalog.js";

const routes = hikeDetails["wachusett-summit"]!.routes;
const input = {
  sessionId: "00000000-0000-4000-8000-000000000001",
  routes,
  state: {
    observedAt: "2026-09-26T12:00:00.000Z",
    receivedAt: "2026-09-26T12:00:01.000Z",
    source: "weather",
    provenance: {
      provider: "Open-Meteo",
      license: "CC BY 4.0",
      attributionUrl: "https://open-meteo.com/",
    },
    weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
    daylight: {
      sunsetAt: "2026-09-26T22:00:00.000Z",
      remainingMinutes: 600,
    },
    user: { paceMph: 2.2, fatigue: "moderate" },
  } satisfies HikingState,
};

test("OpenRouter evaluation requests structured scores and preserves route order", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const responseScores = [...routes].reverse().map((route, index) => ({
    routeId: route.properties.id,
    suitability: 0.5 + index / 10,
  }));
  const fetchMock = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        choices: [
          { message: { content: JSON.stringify({ scores: responseScores }) } },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const result = await evaluateWithOpenRouter(input, {
    apiKey: "openrouter-test-key",
    model: "openai/test-model",
    siteUrl: "https://probablythisway.example",
    fetchImpl: fetchMock,
  });

  assert.equal(capturedUrl, "https://openrouter.ai/api/v1/chat/completions");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer openrouter-test-key");
  assert.equal(headers.get("HTTP-Referer"), "https://probablythisway.example");
  assert.equal(headers.get("X-OpenRouter-Title"), "ProbablyThisWay");
  const requestBody = JSON.parse(String(capturedInit?.body));
  assert.equal(requestBody.model, "openai/test-model");
  assert.equal(requestBody.response_format.type, "json_schema");
  assert.equal(requestBody.response_format.json_schema.strict, true);
  assert.deepEqual(
    requestBody.response_format.json_schema.schema.properties.scores.items
      .properties.routeId.enum,
    routes.map((route) => route.properties.id),
  );
  assert.equal(result.provider, "openrouter");
  assert.deepEqual(
    result.scores.map((score) => score.routeId),
    routes.map((route) => route.properties.id),
  );
});

test("OpenRouter evaluation rejects incomplete route scores", async () => {
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({
        choices: [
          {
            message: {
              content: JSON.stringify({
                scores: responseScoresForFirstTwoRoutes(),
              }),
            },
          },
        ],
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  await assert.rejects(
    evaluateWithOpenRouter(input, {
      apiKey: "openrouter-test-key",
      fetchImpl: fetchMock,
    }),
    /incomplete or unknown route scores/,
  );
});

test("OpenRouter evaluation refuses insecure credential endpoints", async () => {
  await assert.rejects(
    evaluateWithOpenRouter(input, {
      apiKey: "openrouter-test-key",
      apiUrl: "http://openrouter.example.test/chat/completions",
    }),
    /OPENROUTER_API_URL must use HTTPS/,
  );
});
test("missing credentials and provider failures use the labeled baseline", async () => {
  const withoutKey = await evaluateRoutes(input, {});
  assert.equal(withoutKey.provider, "deterministic-baseline");

  const fetchMock = (async () =>
    new Response("unavailable", { status: 503 })) as typeof fetch;
  const originalError = console.error;
  console.error = () => undefined;
  try {
    const failedProvider = await evaluateRoutes(
      input,
      { OPENROUTER_API_KEY: "openrouter-test-key" },
      fetchMock,
    );
    assert.equal(failedProvider.provider, "deterministic-baseline");
  } finally {
    console.error = originalError;
  }
});

function responseScoresForFirstTwoRoutes() {
  return routes.slice(0, 2).map((route) => ({
    routeId: route.properties.id,
    suitability: 0.5,
  }));
}
