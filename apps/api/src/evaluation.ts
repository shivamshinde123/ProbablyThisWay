import { randomUUID } from "node:crypto";
import { z } from "zod";
import { routeEvaluationSchema, type HikingState, type RouteEvaluation, type RouteFeature } from "@probably-this-way/contracts";

const jevResponseSchema = z.object({
  code: z.number().optional(),
  data: z.object({ answers: z.record(z.string(), z.object({ noul: z.number().min(0).max(1) })) }),
});

type EvaluationInput = { sessionId: string; state: HikingState; routes: RouteFeature[] };
const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function evaluateDeterministicBaseline({ sessionId, state, routes }: EvaluationInput): RouteEvaluation {
  const fatigueFit = { low: 1, moderate: 0.72, high: 0.4 }[state.user.fatigue];
  const exposureFit = { low: 0.96, moderate: 0.84, high: 0.7 };
  const scores = routes.map((route) => {
    const daylightFit = clamp((state.daylight.remainingMinutes - route.properties.estimatedMinutes + 30) / 120);
    const effortFit = clamp(1 - route.properties.elevationGainFeet / 1_500);
    const weatherPenalty = clamp(state.weather.rainProbability * 0.3 + state.weather.windMph / 100);
    const weatherFit = clamp(exposureFit[route.properties.exposure] - weatherPenalty);
    const suitability = clamp(daylightFit * 0.4 + weatherFit * 0.25 + effortFit * 0.25 + fatigueFit * 0.1);
    return { routeId: route.properties.id, suitability: Number(suitability.toFixed(3)) };
  });
  return routeEvaluationSchema.parse({
    id: randomUUID(), sessionId, status: "completed", createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-v1", provider: "deterministic-baseline", scores,
  });
}

async function evaluateWithJev({ sessionId, state, routes }: EvaluationInput, apiKey: string): Promise<RouteEvaluation> {
  const questionEntries = routes.map((route, index) => [`route_${index}`, {
    type: "noul", instructions: `Is route ${route.properties.name} appropriate for the current hiking state?`,
  }]);
  const routeIds = Object.fromEntries(routes.map((route, index) => [`route_${index}`, route.properties.id]));
  const response = await fetch(process.env.JEV_API_URL ?? "https://www.jevai.org/api/v1/decisions", {
    method: "POST",
    headers: { authorization: `Bearer ${apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      state: {
        hikingState: state,
        routes: routes.map(({ properties }) => properties),
        safetyBoundary: "Decision support only. Do not assume route safety or invent missing facts.",
      },
      questions: Object.fromEntries(questionEntries),
    }),
    signal: AbortSignal.timeout(4_000),
  });
  if (!response.ok) throw new Error(`Jev returned ${response.status}`);
  const parsed = jevResponseSchema.parse(await response.json());
  if (parsed.code !== undefined && parsed.code !== 0) throw new Error(`Jev returned code ${parsed.code}`);
  const scores = routes.map((route, index) => {
    const answer = parsed.data.answers[`route_${index}`];
    if (!answer) throw new Error(`Jev omitted route_${index}`);
    return { routeId: routeIds[`route_${index}`] ?? route.properties.id, suitability: answer.noul };
  });
  return routeEvaluationSchema.parse({
    id: randomUUID(), sessionId, status: "completed", createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-v1", provider: "jev", scores,
  });
}

export async function evaluateRoutes(input: EvaluationInput): Promise<RouteEvaluation> {
  const apiKey = process.env.JEV_API_KEY?.trim();
  if (!apiKey) return evaluateDeterministicBaseline(input);
  try {
    return await evaluateWithJev(input, apiKey);
  } catch (error) {
    console.error("Jev evaluation failed; using deterministic baseline", error);
    return evaluateDeterministicBaseline(input);
  }
}
