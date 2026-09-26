import assert from "node:assert/strict";
import { test } from "node:test";
import type { InternetTrailResult } from "@probably-this-way/contracts";
import { createInternetHike } from "./internet-hike.js";

test("internet trail networks keep the eight longest branches", () => {
  const coordinates = Array.from({ length: 10 }, (_, index) => [
    [-71.82, 42.27],
    [-71.82 + (index + 1) / 1_000, 42.27],
  ]) as [number, number][][];
  const trail: InternetTrailResult = {
    id: "osm-way-network",
    name: "Worcester trail network",
    location: "Worcester, Massachusetts",
    distanceMiles: 5,
    source: "OpenStreetMap via Nominatim",
    sourceUrl: "https://www.openstreetmap.org/way/1",
    geometry: { type: "MultiLineString", coordinates },
  };

  const hike = createInternetHike(trail, "2026-09-26T12:00:00.000Z");

  assert.equal(hike.routes.length, 8);
  assert.ok(
    hike.routes.every(
      (route, index, routes) =>
        index === 0 ||
        routes[index - 1]!.properties.distanceMiles >=
          route.properties.distanceMiles,
    ),
  );
  assert.equal(hike.routes[0]!.properties.segmentIds[0], 1);
});

test("single-line internet trails remain one candidate", () => {
  const trail: InternetTrailResult = {
    id: "osm-way-one",
    name: "Cascades Trail",
    location: "Worcester, Massachusetts",
    distanceMiles: 0.5,
    source: "OpenStreetMap via Nominatim",
    sourceUrl: "https://www.openstreetmap.org/way/2",
    geometry: {
      type: "LineString",
      coordinates: [
        [-71.86, 42.29],
        [-71.85, 42.3],
      ],
    },
  };

  const hike = createInternetHike(trail);
  assert.equal(hike.routes.length, 1);
  assert.equal(hike.routes[0]!.properties.name, "Cascades Trail");
});
