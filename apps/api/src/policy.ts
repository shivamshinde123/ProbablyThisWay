import { routeRecommendationSchema, type HikingState, type RouteEvaluation, type RouteFeature, type RouteRecommendation } from "@probably-this-way/contracts";

export function selectRouteRecommendation(evaluation: RouteEvaluation, routes: RouteFeature[], state: HikingState): RouteRecommendation {
  const scoresByRoute = new Map(evaluation.scores.map((score) => [score.routeId, score]));
  let winner: { routeId: string; suitability: number } | undefined;

  for (const route of routes) {
    const score = scoresByRoute.get(route.properties.id);
    if (score && (!winner || score.suitability > winner.suitability)) winner = score;
  }

  if (!winner) throw new Error("Evaluation contains no scores for the available routes");
  const route = routes.find((candidate) => candidate.properties.id === winner.routeId);
  if (!route) throw new Error("Recommended route is not available for this hike");
  const daylightMargin = state.daylight.remainingMinutes - route.properties.estimatedMinutes;
  const daylightValue = daylightMargin >= 0 ? `${daylightMargin} min before sunset` : `${Math.abs(daylightMargin)} min beyond sunset`;
  const explanation = `${route.properties.name} ranks highest for the current snapshot. Its ${route.properties.estimatedMinutes}-minute estimate leaves ${daylightValue}, with ${route.properties.exposure} exposure.`;

  return routeRecommendationSchema.parse({
    routeId: winner.routeId,
    suitability: winner.suitability,
    policyVersion: "highest-suitability-v1",
    decidedAt: new Date().toISOString(),
    explanation,
    factors: [
      { label: "Daylight", value: daylightValue },
      { label: "Exposure", value: route.properties.exposure },
      { label: "Elevation", value: `+${route.properties.elevationGainFeet.toLocaleString("en-US")} ft` },
    ],
  });
}
