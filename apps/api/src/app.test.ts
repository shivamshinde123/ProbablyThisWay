import assert from "node:assert/strict";
import { test } from "node:test";
import { hikeDetailSchema } from "@probably-this-way/contracts";
import { buildApp } from "./app.js";

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
  const body = response.json();
  assert.equal(body.selectedRouteId, "balanced-traverse");
  assert.equal(body.state.source, "prototype-static");
  assert.equal(body.state.daylight.remainingMinutes, 159);
  await app.close();
});

test("POST /api/v1/sessions rejects a route outside the hike", async () => {
  const app = await buildApp();
  const response = await app.inject({ method: "POST", url: "/api/v1/sessions", payload: { hikeId: "wachusett-summit", selectedRouteId: "unknown" } });
  assert.equal(response.statusCode, 422);
  assert.equal(response.json().error.code, "invalid_route");
  await app.close();
});
