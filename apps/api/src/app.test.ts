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
