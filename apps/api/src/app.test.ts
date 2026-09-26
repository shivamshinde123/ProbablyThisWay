import assert from "node:assert/strict";
import { test } from "node:test";
import { decisionEventsResponseSchema, hikeDetailSchema, latestDecisionSchema, routeEvaluationSchema, sessionStartResponseSchema, stateUpdateResponseSchema } from "@probably-this-way/contracts";
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

test("PATCH state accumulates small changes and re-evaluates at the threshold", async () => {
  const app = await buildApp();
  const createdResponse = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" } });
  const created = sessionStartResponseSchema.parse(createdResponse.json());
  const firstObservedAt = new Date(Date.parse(created.session.state.observedAt) + 60_000).toISOString();
  const firstResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/sessions/${created.session.id}/state`,
    payload: { observedAt: firstObservedAt, source: "weather", changes: { windMph: 10 } },
  });
  assert.equal(firstResponse.statusCode, 202);
  const first = stateUpdateResponseSchema.parse(firstResponse.json());
  assert.equal(first.evaluationQueued, false);
  assert.equal(first.sequence, 1);
  assert.deepEqual(first.crossedThresholds, []);

  const secondResponse = await app.inject({
    method: "PATCH",
    url: `/api/v1/sessions/${created.session.id}/state`,
    payload: { observedAt: new Date(Date.parse(firstObservedAt) + 60_000).toISOString(), source: "weather", changes: { windMph: 13 } },
  });
  assert.equal(secondResponse.statusCode, 202);
  const second = stateUpdateResponseSchema.parse(secondResponse.json());
  assert.equal(second.evaluationQueued, true);
  assert.equal(second.sequence, 2);
  assert.deepEqual(second.crossedThresholds, ["windMph"]);
  assert.notEqual(second.decision?.evaluation.id, created.evaluation.id);

  const current = await app.inject({ method: "GET", url: `/api/v1/sessions/${created.session.id}` });
  assert.equal(current.statusCode, 200);
  assert.equal(current.json().session.state.weather.windMph, 13);
  assert.equal(current.json().session.state.source, "weather");
  assert.equal(current.json().sequence, 2);
  await app.close();
});

test("PATCH state rejects stale and empty updates", async () => {
  const app = await buildApp();
  const createdResponse = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" } });
  const created = sessionStartResponseSchema.parse(createdResponse.json());

  const stale = await app.inject({
    method: "PATCH",
    url: `/api/v1/sessions/${created.session.id}/state`,
    payload: { observedAt: created.session.state.observedAt, source: "weather", changes: { windMph: 20 } },
  });
  assert.equal(stale.statusCode, 409);
  assert.equal(stale.json().error.code, "stale_state_update");

  const empty = await app.inject({
    method: "PATCH",
    url: `/api/v1/sessions/${created.session.id}/state`,
    payload: { observedAt: new Date(Date.parse(created.session.state.observedAt) + 60_000).toISOString(), source: "weather", changes: {} },
  });
  assert.equal(empty.statusCode, 422);
  assert.equal(empty.json().error.code, "invalid_state_update");
  await app.close();
});

test("PATCH state returns a structured 404 for an unknown session", async () => {
  const app = await buildApp();
  const response = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/00000000-0000-4000-8000-000000000000/state",
    payload: { observedAt: new Date().toISOString(), source: "weather", changes: { windMph: 20 } },
  });
  assert.equal(response.statusCode, 404);
  assert.equal(response.json().error.code, "session_not_found");
  await app.close();
});

test("decision events expose an ordered cursor feed for session start and re-evaluation", async () => {
  const app = await buildApp();
  const createdResponse = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" } });
  const created = sessionStartResponseSchema.parse(createdResponse.json());

  const initialResponse = await app.inject({ method: "GET", url: "/api/v1/sessions/" + created.session.id + "/events" });
  assert.equal(initialResponse.statusCode, 200);
  const initial = decisionEventsResponseSchema.parse(initialResponse.json());
  assert.equal(initial.nextCursor, 1);
  assert.equal(initial.items.length, 1);
  assert.equal(initial.items[0]?.type, "session_started");
  assert.deepEqual(initial.items[0]?.crossedThresholds, []);

  const updateResponse = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/" + created.session.id + "/state",
    payload: {
      observedAt: new Date(Date.parse(created.session.state.observedAt) + 60_000).toISOString(),
      source: "weather",
      changes: { windMph: 13 },
    },
  });
  assert.equal(updateResponse.statusCode, 202);

  const nextResponse = await app.inject({ method: "GET", url: "/api/v1/sessions/" + created.session.id + "/events?after=1" });
  assert.equal(nextResponse.statusCode, 200);
  const next = decisionEventsResponseSchema.parse(nextResponse.json());
  assert.equal(next.nextCursor, 2);
  assert.equal(next.items.length, 1);
  assert.equal(next.items[0]?.type, "recommendation_updated");
  assert.deepEqual(next.items[0]?.crossedThresholds, ["windMph"]);
  assert.equal(next.items[0]?.state.weather.windMph, 13);

  const emptyResponse = await app.inject({ method: "GET", url: "/api/v1/sessions/" + created.session.id + "/events?after=2" });
  const empty = decisionEventsResponseSchema.parse(emptyResponse.json());
  assert.deepEqual(empty.items, []);
  assert.equal(empty.nextCursor, 2);
  await app.close();
});

test("decision events reject invalid cursors and unknown sessions", async () => {
  const app = await buildApp();
  const createdResponse = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" } });
  const created = sessionStartResponseSchema.parse(createdResponse.json());

  const invalid = await app.inject({ method: "GET", url: "/api/v1/sessions/" + created.session.id + "/events?after=-1" });
  assert.equal(invalid.statusCode, 422);
  assert.equal(invalid.json().error.code, "invalid_cursor");

  const missing = await app.inject({ method: "GET", url: "/api/v1/sessions/00000000-0000-4000-8000-000000000000/events" });
  assert.equal(missing.statusCode, 404);
  assert.equal(missing.json().error.code, "session_not_found");
  await app.close();
});

test("PATCH state enforces configured adapter credentials before session lookup", async () => {
  const token = "a-secure-adapter-token-with-32-chars";
  const app = await buildApp({ adapterAuthEnv: { NODE_ENV: "development", STATE_ADAPTER_TOKEN: token } });
  const createdResponse = await app.inject({
    method: "POST",
    url: "/api/v1/sessions",
    payload: { hikeId: "wachusett-summit", selectedRouteId: "balanced-traverse" },
  });
  const created = sessionStartResponseSchema.parse(createdResponse.json());
  const payload = {
    observedAt: new Date(Date.parse(created.session.state.observedAt) + 60_000).toISOString(),
    source: "weather",
    changes: { windMph: 10 },
  };

  const missing = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/" + created.session.id + "/state",
    payload,
  });
  assert.equal(missing.statusCode, 401);
  assert.equal(missing.json().error.code, "adapter_unauthorized");
  assert.equal(missing.headers["www-authenticate"], 'Bearer realm="state-adapter"');

  const wrong = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/00000000-0000-4000-8000-000000000000/state",
    headers: { authorization: "Bearer wrong-token" },
    payload,
  });
  assert.equal(wrong.statusCode, 401);

  const accepted = await app.inject({
    method: "PATCH",
    url: "/api/v1/sessions/" + created.session.id + "/state",
    headers: { authorization: "Bearer " + token },
    payload,
  });
  assert.equal(accepted.statusCode, 202);
  assert.equal(stateUpdateResponseSchema.parse(accepted.json()).accepted, true);
  await app.close();
});
