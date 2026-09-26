import { routeRecommendationSchema, type RouteEvaluation, type RouteFeature, type RouteRecommendation } from "@probably-this-way/contracts";

export function selectRouteRecommendation(evaluation: RouteEvaluation, routes: RouteFeature[]): RouteRecommendation {
  const scoresByRoute = new Map(evaluation.scores.map((score) => [score.routeId, score]));
  let winner: { routeId: string; suitability: number } | undefined;

  for (const route of routes) {
    const score = scoresByRoute.get(route.properties.id);
    if (score && (!winner || score.suitability > winner.suitability)) winner = score;
  }

  if (!winner) throw new Error("Evaluation contains no scores for the available routes");
  return routeRecommendationSchema.parse({
    routeId: winner.routeId,
    suitability: winner.suitability,
    policyVersion: "highest-suitability-v1",
    decidedAt: new Date().toISOString(),
  });
}
