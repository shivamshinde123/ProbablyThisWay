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
