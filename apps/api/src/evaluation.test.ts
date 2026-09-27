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

function scoreAnswer(score: number, confidence = 0.84) {
  return {
    type: "score",
    score,
    probabilities: { "0": 0, "1": 0.05, "2": 0.1, "3": 0.65, "4": 0.2 },
    confidence,
  };
}

test("OpenRouter evaluation uses only Jev Decisions API and preserves route order", async () => {
  let capturedUrl = "";
  let capturedInit: RequestInit | undefined;
  const fetchMock = (async (
    url: string | URL | Request,
    init?: RequestInit,
  ) => {
    capturedUrl = String(url);
    capturedInit = init;
    return new Response(
      JSON.stringify({
        id: "gen-dec-test",
        model: "typesafe/jev-1.13-20260917",
        provider: "TypeSafe",
        answers: Object.fromEntries(
          routes.map((_, index) => [
            `route_${index + 1}`,
            scoreAnswer(2 + index * 0.5, 0.8 + index * 0.05),
          ]),
        ),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    );
  }) as typeof fetch;

  const result = await evaluateWithOpenRouter(input, {
    apiKey: "openrouter-test-key",
    siteUrl: "https://probablythisway.example",
    fetchImpl: fetchMock,
  });

  assert.equal(capturedUrl, "https://openrouter.ai/api/alpha/decisions");
  const headers = new Headers(capturedInit?.headers);
  assert.equal(headers.get("authorization"), "Bearer openrouter-test-key");
  assert.equal(headers.get("HTTP-Referer"), "https://probablythisway.example");
  assert.equal(headers.get("X-Title"), "ProbablyThisWay");
  const requestBody = JSON.parse(String(capturedInit?.body));
  assert.equal(requestBody.model, "~typesafe/jev-latest");
  assert.equal(requestBody.messages, undefined);
  assert.equal(requestBody.response_format, undefined);
  assert.deepEqual(
    requestBody.state.candidateRoutes.map((route: { id: string }) => route.id),
    routes.map((route) => route.properties.id),
  );
  assert.deepEqual(Object.keys(requestBody.questions), [
    "route_1",
    "route_2",
    "route_3",
  ]);
  assert.equal(requestBody.questions.route_1.type, "score");
  assert.equal(requestBody.questions.route_1.criteria.length, 5);
  assert.match(
    requestBody.questions.route_1.instructions,
    /candidateRoutes\[0\]/,
  );
  assert.equal(result.provider, "openrouter-jev");
  assert.equal(result.questionSetVersion, "route-suitability-jev-v1");
  assert.equal(result.model, "typesafe/jev-1.13-20260917");
  assert.deepEqual(
    result.scores.map((score) => score.routeId),
    routes.map((route) => route.properties.id),
  );
  assert.deepEqual(
    result.scores.map((score) => score.suitability),
    [0.5, 0.625, 0.75],
  );
  assert.equal(result.scores[0]?.rawScore, 2);
  assert.equal(result.scores[0]?.confidence, 0.8);
  assert.equal(result.scores[0]?.probabilities?.["3"], 0.65);
});

test("OpenRouter Jev evaluation rejects incomplete route answers", async () => {
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({
        model: "typesafe/jev-1.13-20260917",
        answers: { route_1: scoreAnswer(3) },
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  await assert.rejects(
    evaluateWithOpenRouter(input, {
      apiKey: "openrouter-test-key",
      fetchImpl: fetchMock,
    }),
    /incomplete or unknown route answers/,
  );
});

test("OpenRouter Jev evaluation rejects any non-Jev model response", async () => {
  const fetchMock = (async () =>
    new Response(
      JSON.stringify({
        model: "openai/generic-chat-model",
        answers: Object.fromEntries(
          routes.map((_, index) => [`route_${index + 1}`, scoreAnswer(3)]),
        ),
      }),
      { status: 200, headers: { "content-type": "application/json" } },
    )) as typeof fetch;

  await assert.rejects(
    evaluateWithOpenRouter(input, {
      apiKey: "openrouter-test-key",
      fetchImpl: fetchMock,
    }),
    /non-Jev model/,
  );
});

test("OpenRouter Jev evaluation refuses insecure credential endpoints", async () => {
  await assert.rejects(
    evaluateWithOpenRouter(input, {
      apiKey: "openrouter-test-key",
      apiUrl: "http://openrouter.example.test/decisions",
    }),
    /OPENROUTER_DECISIONS_API_URL must use HTTPS/,
  );
});

test("missing credentials and Jev provider failures use the labeled baseline", async () => {
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
