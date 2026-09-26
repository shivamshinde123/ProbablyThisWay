import { routeRecommendationSchema, type HikingState, type RouteEvaluation, type RouteFeature, type RouteRecommendation } from "@probably-this-way/contracts";

function exclusionReasons(route: RouteFeature): string[] {
  const reasons: string[] = [];
  if (route.properties.legalStatus !== "legal") reasons.push("Route is not confirmed as a legal trail");
  if (route.properties.accessStatus === "closed") reasons.push("Route is officially closed");
  if (route.properties.accessStatus === "restricted") reasons.push("Route has active access restrictions");
  reasons.push(...route.properties.restrictions
    .filter((restriction) => restriction.kind === "prohibitive")
    .map((restriction) => restriction.summary));
  return [...new Set(reasons)];
}

export function selectRouteRecommendation(evaluation: RouteEvaluation, routes: RouteFeature[], state: HikingState): RouteRecommendation {
  const scoresByRoute = new Map(evaluation.scores.map((score) => [score.routeId, score]));
  const excludedRoutes = routes
    .map((route) => ({ routeId: route.properties.id, reasons: exclusionReasons(route) }))
    .filter((route) => route.reasons.length > 0);
  const excludedIds = new Set(excludedRoutes.map((route) => route.routeId));
  let winner: { routeId: string; suitability: number } | undefined;

  for (const route of routes) {
    if (excludedIds.has(route.properties.id)) continue;
    const score = scoresByRoute.get(route.properties.id);
    if (score && (!winner || score.suitability > winner.suitability)) winner = score;
  }

  if (!winner) {
    return routeRecommendationSchema.parse({
      status: "unavailable",
      policyVersion: "hard-constraints-v2",
      decidedAt: new Date().toISOString(),
      explanation: "No supported route is currently eligible. Do not proceed based on this application; check official guidance and posted notices.",
      factors: [{ label: "Access", value: "No eligible route" }],
      excludedRoutes,
    });
  }

  const route = routes.find((candidate) => candidate.properties.id === winner.routeId);
  if (!route) throw new Error("Recommended route is not available for this hike");
  const daylightMargin = state.daylight.remainingMinutes - route.properties.estimatedMinutes;
  const daylightValue = daylightMargin >= 0 ? `${daylightMargin} min before sunset` : `${Math.abs(daylightMargin)} min beyond sunset`;
  const exposureText = route.properties.exposure === "unknown" ? "exposure is not rated" : `${route.properties.exposure} exposure`;
  const explanation = `${route.properties.name} ranks highest among eligible routes for the current snapshot. Its ${route.properties.estimatedMinutes}-minute estimate leaves ${daylightValue}; ${exposureText}.`;

  return routeRecommendationSchema.parse({
    status: "recommended",
    routeId: winner.routeId,
    suitability: winner.suitability,
    policyVersion: "hard-constraints-v2",
    decidedAt: new Date().toISOString(),
    explanation,
    factors: [
      { label: "Daylight", value: daylightValue },
      { label: "Exposure", value: route.properties.exposure },
      { label: "Elevation", value: `+${route.properties.elevationGainFeet.toLocaleString("en-US")} ft` },
    ],
    excludedRoutes,
  });
}
