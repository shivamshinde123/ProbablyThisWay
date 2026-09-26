import assert from "node:assert/strict";
import test from "node:test";
import { internetTrailSearchResponseSchema } from "@probably-this-way/contracts";
import { NominatimTrailSearchProvider } from "./trail-search.js";

test("Nominatim search returns attributed linear trails and caches duplicate queries", async () => {
  let calls = 0;
  let requestedUrl: URL | undefined;
  let userAgent: string | null = null;
  const provider = new NominatimTrailSearchProvider({
    minimumIntervalMs: 0,
    fetchImpl: async (input, init) => {
      calls += 1;
      requestedUrl = new URL(input.toString());
      userAgent = new Headers(init?.headers).get("user-agent");
      return new Response(
        JSON.stringify({
          type: "FeatureCollection",
          features: [
            {
              type: "Feature",
              properties: {
                osm_type: "way",
                osm_id: 249315063,
                category: "highway",
                type: "path",
                name: "Appalachian Trail",
                display_name:
                  "Appalachian Trail, Salisbury, Connecticut, United States",
              },
              geometry: {
                type: "LineString",
                coordinates: [
                  [-73.4009, 41.977],
                  [-73.4013, 41.9784],
                  [-73.4082, 41.98],
                ],
              },
            },
            {
              type: "Feature",
              properties: {
                osm_type: "node",
                osm_id: 1,
                category: "tourism",
                type: "information",
                name: "Trail marker",
                display_name: "Trail marker, Connecticut",
              },
              geometry: { type: "Point", coordinates: [-73.4, 41.9] },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const first = await provider.search(" Appalachian Trail ");
  const second = await provider.search("appalachian trail");
  const parsed = internetTrailSearchResponseSchema.parse(first);

  assert.equal(calls, 1);
  assert.deepEqual(second, first);
  assert.equal(requestedUrl?.searchParams.get("polygon_geojson"), "1");
  assert.equal(requestedUrl?.searchParams.get("q"), "Appalachian Trail");
  assert.match(userAgent ?? "", /ProbablyThisWay/);
  assert.equal(parsed.items.length, 1);
  assert.equal(parsed.items[0]?.name, "Appalachian Trail");
  assert.ok((parsed.items[0]?.distanceMiles ?? 0) > 0);
  assert.match(parsed.items[0]?.sourceUrl ?? "", /openstreetmap.org\/way\//);
});
test("place search preserves Worcester and returns nearby trail geometry", async () => {
  const requests: URL[] = [];
  const provider = new NominatimTrailSearchProvider({
    minimumIntervalMs: 0,
    fetchImpl: async (input) => {
      const url = new URL(input.toString());
      requests.push(url);
      if (url.hostname === "nominatim.openstreetmap.org") {
        return new Response(
          JSON.stringify({
            type: "FeatureCollection",
            features: [
              {
                type: "Feature",
                properties: {
                  osm_type: "node",
                  osm_id: 358271617,
                  category: "natural",
                  type: "peak",
                  name: "Newton Hill",
                  display_name:
                    "Newton Hill, Worcester, Worcester County, Massachusetts, United States",
                },
                geometry: {
                  type: "Point",
                  coordinates: [-71.8187, 42.2764],
                },
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      return new Response(
        JSON.stringify({
          elements: [
            {
              type: "node",
              id: 1,
              lat: 42.2765,
              lon: -71.8185,
            },
            {
              type: "node",
              id: 2,
              lat: 42.277,
              lon: -71.817,
            },
            {
              type: "node",
              id: 3,
              lat: 42.278,
              lon: -71.816,
            },
            {
              type: "way",
              id: 902079079,
              nodes: [1, 2, 3],
              tags: {
                highway: "path",
                surface: "ground",
              },
            },
            {
              type: "way",
              id: 99,
              nodes: [1, 2],
              tags: {
                highway: "footway",
                footway: "sidewalk",
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    },
  });

  const result = await provider.search("  Newton Hill,   Worcester, MA, USA  ");

  assert.equal(requests.length, 2);
  assert.equal(
    requests[0]?.searchParams.get("q"),
    "Newton Hill, Worcester, MA, USA",
  );
  assert.match(requests[1]?.pathname ?? "", /api\/0\.6\/map/);
  assert.match(requests[1]?.searchParams.get("bbox") ?? "", /,/);
  assert.equal(result.query, "Newton Hill, Worcester, MA, USA");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0]?.name, "Trails at Newton Hill");
  assert.equal(result.items[0]?.id, "osm-nearby-node-358271617");
  assert.equal(result.items[0]?.geometry.type, "LineString");
});
