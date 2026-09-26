import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import {
  routeEvaluationSchema,
  routeFeatureSchema,
  type HikingState,
  type RouteFeature,
} from "@probably-this-way/contracts";
import { selectRouteRecommendation } from "./policy.js";
import { hikeDetails } from "./route-catalog.js";

const state: HikingState = {
  observedAt: "2026-09-26T12:00:00.000Z",
  source: "prototype-static",
  weather: { temperatureF: 55, windMph: 7, rainProbability: 0.1 },
  daylight: { sunsetAt: "2026-09-26T16:00:00.000Z", remainingMinutes: 240 },
  user: { paceMph: 2.2, fatigue: "low" },
};

function withAccess(
  route: RouteFeature,
  properties: Partial<RouteFeature["properties"]>,
): RouteFeature {
  return routeFeatureSchema.parse({
    ...route,
    properties: { ...route.properties, ...properties },
  });
}

function evaluation(routes: RouteFeature[], scores: number[]) {
  return routeEvaluationSchema.parse({
    id: randomUUID(),
    sessionId: randomUUID(),
    status: "completed",
    createdAt: state.observedAt,
    questionSetVersion: "route-suitability-v1",
    provider: "deterministic-baseline",
    scores: routes.map((route, index) => ({
      routeId: route.properties.id,
      suitability: scores[index],
    })),
  });
}

test("hard constraints exclude a higher-scoring closed route before ranking", () => {
  const sourceRoutes = hikeDetails["wachusett-summit"]?.routes;
  assert.ok(sourceRoutes);
  const routes = [
    withAccess(sourceRoutes[0]!, { accessStatus: "closed" }),
    withAccess(sourceRoutes[1]!, { accessStatus: "open" }),
    withAccess(sourceRoutes[2]!, { accessStatus: "open" }),
  ];
  const recommendation = selectRouteRecommendation(
    evaluation(routes, [0.99, 0.72, 0.61]),
    routes,
    state,
  );
  assert.equal(recommendation.status, "recommended");
  if (recommendation.status !== "recommended") return;
  assert.equal(recommendation.routeId, routes[1]?.properties.id);
  assert.deepEqual(recommendation.excludedRoutes, [
    {
      routeId: routes[0]?.properties.id,
      reasons: ["Route is officially closed"],
    },
  ]);
});

test("hard constraints return no recommendation when every route is excluded", () => {
  const sourceRoutes = hikeDetails["wachusett-summit"]?.routes;
  assert.ok(sourceRoutes);
  const routes = [
    withAccess(sourceRoutes[0]!, { accessStatus: "closed" }),
    withAccess(sourceRoutes[1]!, { accessStatus: "restricted" }),
    withAccess(sourceRoutes[2]!, { legalStatus: "illegal" }),
  ];
  const recommendation = selectRouteRecommendation(
    evaluation(routes, [0.9, 0.8, 0.7]),
    routes,
    state,
  );
  assert.equal(recommendation.status, "unavailable");
  assert.equal(recommendation.excludedRoutes.length, 3);
  assert.match(
    recommendation.explanation,
    /No supported route is currently eligible/,
  );
});

test("prohibitive restrictions override suitability while advisories do not", () => {
  const sourceRoutes = hikeDetails["wachusett-summit"]?.routes;
  assert.ok(sourceRoutes);
  const routes = [
    withAccess(sourceRoutes[0]!, {
      accessStatus: "open",
      restrictions: [
        {
          id: "seasonal-closure",
          kind: "prohibitive",
          summary: "Seasonal habitat closure",
          sourceUrl: "https://www.mass.gov/",
        },
      ],
    }),
    withAccess(sourceRoutes[1]!, {
      accessStatus: "open",
      restrictions: [
        {
          id: "mud",
          kind: "advisory",
          summary: "Muddy conditions",
          sourceUrl: "https://www.mass.gov/",
        },
      ],
    }),
    withAccess(sourceRoutes[2]!, { accessStatus: "open" }),
  ];
  const recommendation = selectRouteRecommendation(
    evaluation(routes, [0.99, 0.7, 0.6]),
    routes,
    state,
  );
  assert.equal(recommendation.status, "recommended");
  if (recommendation.status !== "recommended") return;
  assert.equal(recommendation.routeId, routes[1]?.properties.id);
  assert.deepEqual(recommendation.excludedRoutes[0]?.reasons, [
    "Seasonal habitat closure",
  ]);
});
