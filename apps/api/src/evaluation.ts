import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  routeEvaluationSchema,
  type HikingState,
  type RouteEvaluation,
  type RouteFeature,
} from "@probably-this-way/contracts";

const DEFAULT_OPENROUTER_API_URL =
  "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_OPENROUTER_MODEL = "openrouter/auto";
const DEFAULT_OPENROUTER_TIMEOUT_MS = 30_000;
const DEFAULT_OPENROUTER_MAX_TOKENS = 3_000;

const openRouterResponseSchema = z.object({
  model: z.string().optional(),
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullable().optional(),
        message: z.object({ content: z.string().nullable().optional() }),
      }),
    )
    .min(1),
});
const openRouterScoresSchema = z.object({
  scores: z
    .array(
      z.object({
        routeId: z.string().min(1),
        suitability: z.number().min(0).max(1),
      }),
    )
    .min(1),
});

type EvaluationInput = {
  sessionId: string;
  state: HikingState;
  routes: RouteFeature[];
};

type OpenRouterOptions = {
  apiKey: string;
  apiUrl?: string;
  model?: string;
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
  const parsed = new URL(value?.trim() || DEFAULT_OPENROUTER_API_URL);
  if (parsed.protocol !== "https:")
    throw new Error("OPENROUTER_API_URL must use HTTPS");
  return parsed.toString();
}

function validateScores(
  input: EvaluationInput,
  content: string,
): Array<{ routeId: string; suitability: number }> {
  const parsed = openRouterScoresSchema.parse(JSON.parse(content));
  const expectedIds = new Set(input.routes.map((route) => route.properties.id));
  const receivedIds = new Set(parsed.scores.map((score) => score.routeId));
  if (
    receivedIds.size !== parsed.scores.length ||
    receivedIds.size !== expectedIds.size ||
    [...expectedIds].some((routeId) => !receivedIds.has(routeId)) ||
    [...receivedIds].some((routeId) => !expectedIds.has(routeId))
  ) {
    throw new Error("OpenRouter returned incomplete or unknown route scores");
  }
  const byRoute = new Map(
    parsed.scores.map((score) => [score.routeId, score.suitability]),
  );
  return input.routes.map((route) => ({
    routeId: route.properties.id,
    suitability: byRoute.get(route.properties.id)!,
  }));
}

export async function evaluateWithOpenRouter(
  input: EvaluationInput,
  {
    apiKey,
    apiUrl,
    model = DEFAULT_OPENROUTER_MODEL,
    siteUrl,
    appName = "ProbablyThisWay",
    fetchImpl = fetch,
    timeoutMs = DEFAULT_OPENROUTER_TIMEOUT_MS,
  }: OpenRouterOptions,
): Promise<RouteEvaluation> {
  const routeIds = input.routes.map((route) => route.properties.id);
  const headers: Record<string, string> = {
    authorization: `Bearer ${apiKey}`,
    "content-type": "application/json",
    "X-OpenRouter-Title": appName.trim() || "ProbablyThisWay",
  };
  if (siteUrl?.trim()) headers["HTTP-Referer"] = siteUrl.trim();

  const response = await fetchImpl(resolveOpenRouterApiUrl(apiUrl), {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: model.trim() || DEFAULT_OPENROUTER_MODEL,
      temperature: 0,
      max_completion_tokens: DEFAULT_OPENROUTER_MAX_TOKENS,
      reasoning: { effort: "minimal", exclude: true },
      provider: { require_parameters: true },
      messages: [
        {
          role: "system",
          content:
            "Score only the supplied hiking routes from 0 to 1 for suitability under the supplied state. Do not invent routes, facts, closures, or safety guarantees. Return every route exactly once. Application code applies hard constraints and makes the final selection.",
        },
        {
          role: "user",
          content: JSON.stringify({
            hikingState: input.state,
            routes: input.routes.map(({ properties }) => properties),
          }),
        },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "route_suitability",
          strict: true,
          schema: {
            type: "object",
            properties: {
              scores: {
                type: "array",
                minItems: routeIds.length,
                maxItems: routeIds.length,
                items: {
                  type: "object",
                  properties: {
                    routeId: { type: "string", enum: routeIds },
                    suitability: { type: "number", minimum: 0, maximum: 1 },
                  },
                  required: ["routeId", "suitability"],
                  additionalProperties: false,
                },
              },
            },
            required: ["scores"],
            additionalProperties: false,
          },
        },
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`OpenRouter returned ${response.status}`);
  const parsed = openRouterResponseSchema.parse(await response.json());
  const choice = parsed.choices[0];
  const content = choice?.message.content;
  if (!content) {
    const reason = choice?.finish_reason ?? "unknown";
    throw new Error(
      "OpenRouter returned no structured content (" + reason + ")",
    );
  }
  const scores = validateScores(input, content);

  return routeEvaluationSchema.parse({
    id: randomUUID(),
    sessionId: input.sessionId,
    status: "completed",
    createdAt: new Date().toISOString(),
    questionSetVersion: "route-suitability-v1",
    provider: "openrouter",
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
      apiUrl: env.OPENROUTER_API_URL,
      model: env.OPENROUTER_MODEL,
      siteUrl: env.OPENROUTER_SITE_URL,
      appName: env.OPENROUTER_APP_NAME,
      fetchImpl,
    });
  } catch (error) {
    console.error(
      "OpenRouter evaluation failed; using deterministic baseline",
      error,
    );
    return evaluateDeterministicBaseline(input);
  }
}
