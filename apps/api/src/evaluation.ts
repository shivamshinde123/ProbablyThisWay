import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  routeEvaluationSchema,
  type HikingState,
  type RouteEvaluation,
  type RouteFeature,
} from "@probably-this-way/contracts";

const DEFAULT_OPENROUTER_DECISIONS_API_URL =
  "https://openrouter.ai/api/alpha/decisions";
const OPENROUTER_JEV_MODEL = "~typesafe/jev-latest";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 30_000;
const JEV_SCORE_CRITERIA = [
  "Very poor fit: the current hiking state and known route demands strongly conflict",
  "Poor fit: significant concerns outweigh the route's advantages",
  "Mixed or uncertain fit: meaningful tradeoffs or unknown facts prevent a clear recommendation",
  "Good fit: the route generally matches the current state with limited concerns",
  "Excellent fit: the route strongly matches the current state and known route demands",
] as const;

const jevScoreAnswerSchema = z.object({
  type: z.literal("score"),
  score: z
    .number()
    .min(0)
    .max(JEV_SCORE_CRITERIA.length - 1),
  probabilities: z.record(z.string(), z.number().min(0).max(1)),
  confidence: z.number().min(0).max(1),
  legend: z.record(z.string(), z.string()).optional(),
});
const openRouterJevResponseSchema = z.object({
  id: z.string().optional(),
  model: z.string().min(1),
  provider: z.string().optional(),
  answers: z.record(z.string(), jevScoreAnswerSchema),
});

type EvaluationInput = {
  sessionId: string;
  state: HikingState;
  routes: RouteFeature[];
};

type OpenRouterOptions = {
  apiKey: string;
  apiUrl?: string;
  siteUrl?: string;
  appName?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

const clamp = (value: number) => Math.max(0, Math.min(1, value));

export function evaluateDeterministicBaseline({
  sessionId,
  state,
  routes,
}: EvaluationInput): RouteEvaluation {
  const fatigueFit = { low: 1, moderate: 0.72, high: 0.4 }[state.user.fatigue];
  const exposureFit = { low: 0.96, moderate: 0.84, high: 0.7, unknown: 0.5 };
  const scores = routes.map((route) => {
    const daylightFit = clamp(
      (state.daylight.remainingMinutes -
        route.properties.estimatedMinutes +
        30) /
        120,
    );
    const effortFit = clamp(1 - route.properties.elevationGainFeet / 1_500);
    const weatherPenalty = clamp(
      state.weather.rainProbability * 0.3 + state.weather.windMph / 100,
    );
    const weatherFit = clamp(
      exposureFit[route.properties.exposure] - weatherPenalty,
    );
    const suitability = clamp(
      daylightFit * 0.4 +
        weatherFit * 0.25 +
        effortFit * 0.25 +
        fatigueFit * 0.1,
    );
    return {
      routeId: route.properties.id,
      suitability: Number(suitability.toFixed(3)),
    };
  });
  return routeEvaluationSchema.parse({
    id: randomUUID(),
    sessionId,
    status: "completed",
    createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-v1",
    provider: "deterministic-baseline",
    scores,
  });
}

function resolveOpenRouterApiUrl(value: string | undefined): string {
  const parsed = new URL(value?.trim() || DEFAULT_OPENROUTER_DECISIONS_API_URL);
  if (parsed.protocol !== "https:")
    throw new Error("OPENROUTER_DECISIONS_API_URL must use HTTPS");
  return parsed.toString();
}

function questionKey(index: number): string {
  return `route_${index + 1}`;
}

function buildJevQuestions(routes: RouteFeature[]) {
  return Object.fromEntries(
    routes.map((_, index) => [
      questionKey(index),
      {
        type: "score",
        instructions:
          `How suitable is candidateRoutes[${index}] for the hiking session described by hikingState? ` +
          "Consider weather, remaining daylight, pace, fatigue, estimated duration, elevation gain, exposure, condition, and data quality. " +
          "Rate situational fit, not safety or legal eligibility; application policy separately enforces hard constraints. " +
          "Treat unknown values as uncertainty, never as favorable facts.",
        criteria: JEV_SCORE_CRITERIA,
      },
    ]),
  );
}

function validateJevAnswers(
  input: EvaluationInput,
  response: z.infer<typeof openRouterJevResponseSchema>,
) {
  if (!response.model.startsWith("typesafe/jev-"))
    throw new Error("OpenRouter returned a non-Jev model");
  const expectedKeys = input.routes.map((_, index) => questionKey(index));
  const receivedKeys = Object.keys(response.answers);
  if (
    receivedKeys.length !== expectedKeys.length ||
    expectedKeys.some((key) => !(key in response.answers)) ||
    receivedKeys.some((key) => !expectedKeys.includes(key))
  ) {
    throw new Error(
      "OpenRouter Jev returned incomplete or unknown route answers",
    );
  }

  const maximumScore = JEV_SCORE_CRITERIA.length - 1;
  return input.routes.map((route, index) => {
    const answer = response.answers[questionKey(index)]!;
    const probabilityKeys = Object.keys(answer.probabilities).sort();
    const expectedProbabilityKeys = JEV_SCORE_CRITERIA.map((_, level) =>
      String(level),
    );
    const probabilityTotal = Object.values(answer.probabilities).reduce(
      (total, probability) => total + probability,
      0,
    );
    if (
      probabilityKeys.join(",") !== expectedProbabilityKeys.join(",") ||
      Math.abs(probabilityTotal - 1) > 0.02
    ) {
      throw new Error("OpenRouter Jev returned an invalid score distribution");
    }
    return {
      routeId: route.properties.id,
      suitability: Number((answer.score / maximumScore).toFixed(3)),
      rawScore: answer.score,
      confidence: answer.confidence,
      probabilities: answer.probabilities,
    };
  });
}

export async function evaluateWithOpenRouter(
  input: EvaluationInput,
  {
    apiKey,
    apiUrl,
    siteUrl,
    appName = "ProbablyThisWay",
    fetchImpl = fetch,
    timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS,
  }: OpenRouterOptions,
): Promise<RouteEvaluation> {
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "X-Title": appName.trim() || "ProbablyThisWay",
  };
  if (siteUrl?.trim()) headers["HTTP-Referer"] = siteUrl.trim();

  const response = await fetchImpl(resolveOpenRouterApiUrl(apiUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: OPENROUTER_JEV_MODEL,
      state: {
        hikingState: input.state,
        candidateRoutes: input.routes.map(({ properties }) => properties),
      },
      questions: buildJevQuestions(input.routes),
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok)
    throw new Error(`OpenRouter Jev returned ${response.status}`);
  const parsed = openRouterJevResponseSchema.parse(await response.json());
  const scores = validateJevAnswers(input, parsed);

  return routeEvaluationSchema.parse({
    id: randomUUID(),
    sessionId: input.sessionId,
    status: "completed",
    createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-jev-v1",
    provider: "openrouter-jev",
    model: parsed.model,
    scores,
  });
}

export async function evaluateRoutes(
  input: EvaluationInput,
  env: NodeJS.ProcessEnv = process.env,
  fetchImpl: typeof fetch = fetch,
): Promise<RouteEvaluation> {
  const apiKey = env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) return evaluateDeterministicBaseline(input);
  try {
    return await evaluateWithOpenRouter(input, {
      apiKey,
      apiUrl: env.OPENROUTER_DECISIONS_API_URL,
      siteUrl: env.OPENROUTER_SITE_URL,
      appName: env.OPENROUTER_APP_NAME,
      fetchImpl,
    });
  } catch (error) {
    console.error(
      "OpenRouter Jev evaluation failed; using deterministic baseline",
      error,
    );
    return evaluateDeterministicBaseline(input);
  }
}
