import assert from "node:assert/strict";
import test from "node:test";
import { hikeDetails } from "./route-catalog.js";

test("catalog exposes only authoritative legal DCR summit routes", () => {
  const hike = hikeDetails["wachusett-summit"];
  assert.ok(hike);
  assert.deepEqual(hike.routes.map((route) => route.properties.id), [
    "pine-hill-summit",
    "mountain-house-summit",
    "harrington-summit",
  ]);
  for (const route of hike.routes) {
    assert.equal(route.properties.dataQuality, "authoritative");
    assert.equal(route.properties.legalStatus, "legal");
    assert.equal(route.properties.source, "Massachusetts DCR Roads and Trails");
    assert.ok(route.properties.segmentIds.length > 0);
    assert.ok(route.geometry.coordinates.length > 20);
  }
});

test("authoritative route coordinates remain geographically plausible", () => {
  const hike = hikeDetails["wachusett-summit"];
  assert.ok(hike);
  for (const route of hike.routes) {
    for (const [longitude, latitude, elevation] of route.geometry.coordinates) {
      assert.ok(longitude >= -71.91 && longitude <= -71.87);
      assert.ok(latitude >= 42.47 && latitude <= 42.50);
      assert.equal(elevation, 0);
    }
  }
});
