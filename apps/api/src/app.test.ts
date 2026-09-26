import assert from "node:assert/strict";
import { test } from "node:test";
import { hikeDetailSchema, latestDecisionSchema, routeEvaluationSchema, sessionStartResponseSchema } from "@probably-this-way/contracts";
import { buildApp } from "./app.js";
import { selectRouteRecommendation } from "./policy.js";

delete process.env.JEV_API_KEY;

test("GET /api/v1/hikes/:hikeId returns three contract-valid route alternatives", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/hikes/wachusett-summit" });
  assert.equal(response.statusCode, 200);
  const hike = hikeDetailSchema.parse(response.json());
  assert.equal(hike.routes.length, 3);
  assert.equal(hike.routes[0]?.properties.dataQuality, "preview");
  assert.deepEqual(hike.routes.map((route) => route.properties.exposure), ["high", "moderate", "low"]);
  await app.close();
});

test("GET /api/v1/hikes/:hikeId returns a structured 404", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/hikes/unknown" });
  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.json(), { error: { code: "hike_not_found", message: "Hike not found", details: {} } });
  await app.close();
});
test("POST /api/v1/sessions creates a typed static-state session", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" } });
  assert.equal(response.statusCode, 201);
  const body = sessionStartResponseSchema.parse(response.json());
  assert.equal(body.session.selectedRouteId, "balanced-traverse");
  assert.equal(body.session.state.source, "prototype-static");
  assert.equal(body.session.state.daylight.remainingMinutes, 159);
  assert.equal(body.evaluation.provider, "deterministic-baseline");
  assert.equal(body.evaluation.scores.length, 3);
  assert.ok(body.evaluation.scores.every((score) => score.suitability >= 0 && score.suitability <= 1));
  assert.equal(body.recommendation.routeId, "lower-return");
  assert.equal(body.recommendation.suitability, Math.max(...body.evaluation.scores.map((score) => score.suitability)));
  assert.match(body.recommendation.explanation, /Lower Return ranks highest/);
  assert.deepEqual(body.recommendation.factors.map((factor) => factor.label), ["Daylight", "Exposure", "Elevation"]);
  const latest = await app.inject({ method: "GET", url: `/api/v1/sessions/${body.session.id}/evaluations/latest` });
  assert.equal(latest.statusCode, 200);
  assert.deepEqual(latestDecisionSchema.parse(latest.json()), { evaluation: body.evaluation, recommendation: body.recommendation });
  await app.close();
});

test("POST /api/v1/sessions rejects a route outside the hike", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "unknown" } });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "invalid_route");
  await app.close();
});
test("GET latest evaluation returns a structured 404 for an unknown session", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/sessions/00000000-0000-4000-8000-000000000000/evaluations/latest" });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "evaluation_not_found");
  await app.close();
});
test("route policy resolves equal scores by stable route order", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "GET", url: "/api/v1/hikes/wachusett-summit" });
  const hike = hikeDetailSchema.parse(response.json());
  const evaluation = routeEvaluationSchema.parse({
    id: "00000000-0000-4000-8000-000000000001",
    sessionId: "00000000-0000-4000-8000-000000000002",
    status: "completed",
    createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-v1",
    provider: "deterministic-baseline",
    scores: hike.routes.map((route) => ({ routeId: route.properties.id, suitability: 0.5 })),
  });
  const recommendation = selectRouteRecommendation(evaluation, hike.routes, {
    observedAt: new Date().toISOString(), source: "prototype-static",
    weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
    daylight: { sunsetAt: new Date(Date.now() + 159 * 60_000).toISOString(), remainingMinutes: 159 },
    user: { paceMph: 2.1, fatigue: "low" },
  });
  assert.equal(recommendation.routeId, hike.routes[0]?.properties.id);
  await app.close();
});
