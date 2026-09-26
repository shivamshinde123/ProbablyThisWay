import { z } from "zod";

export const hikeSummarySchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().min(1),
  difficulty: z.enum(["easy", "moderate", "hard"]),
  distanceMiles: z.number().positive(),
  elevationGainFeet: z.number().nonnegative(),
});
export type HikeSummary = z.infer<typeof hikeSummarySchema>;
export const hikesResponseSchema = z.object({
  items: z.array(hikeSummarySchema),
});

export const trailCoordinateSchema = z.tuple([
  z.number().min(-180).max(180),
  z.number().min(-90).max(90),
  z.number(),
]);
export const routeFeatureSchema = z.object({
  type: z.literal("Feature"),
  geometry: z.object({
    type: z.literal("LineString"),
    coordinates: z.array(trailCoordinateSchema).min(2),
  }),
  properties: z.object({
    id: z.string().min(1),
    name: z.string().min(1),
    source: z.string().min(1),
    sourceUrl: z.string().url(),
    datasetUpdatedAt: z.string().datetime(),
    segmentIds: z.array(z.number().int().positive()).min(1),
    legalStatus: z.enum(["legal", "illegal", "unknown"]),
    accessStatus: z
      .enum(["open", "closed", "restricted", "unknown"])
      .default("unknown"),
    restrictions: z
      .array(
        z.object({
          id: z.string().min(1),
          kind: z.enum(["prohibitive", "advisory"]),
          summary: z.string().min(1),
          sourceUrl: z.string().url(),
        }),
      )
      .default([]),
    condition: z.enum(["good", "fair", "poor", "mixed", "unknown"]),
    dataQuality: z.enum(["preview", "authoritative"]),
    distanceMiles: z.number().positive(),
    elevationSource: z.enum([
      "official-trail-map",
      "provider",
      "terrain",
      "not-provided",
    ]),
    elevationGainFeet: z.number().nonnegative(),
    estimatedMinutes: z.number().int().positive(),
    exposure: z.enum(["low", "moderate", "high", "unknown"]),
  }),
});
export type RouteFeature = z.infer<typeof routeFeatureSchema>;
const internetTrailLineSchema = z
  .array(z.tuple([z.number().min(-180).max(180), z.number().min(-90).max(90)]))
  .min(2);
export const internetTrailResultSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  location: z.string().min(1),
  distanceMiles: z.number().positive(),
  geometry: z.union([
    z.object({
      type: z.literal("LineString"),
      coordinates: internetTrailLineSchema,
    }),
    z.object({
      type: z.literal("MultiLineString"),
      coordinates: z.array(internetTrailLineSchema).min(1),
    }),
  ]),
  source: z.literal("OpenStreetMap via Nominatim"),
  sourceUrl: z.string().url(),
});
export type InternetTrailResult = z.infer<typeof internetTrailResultSchema>;
export const internetTrailSearchResponseSchema = z.object({
  query: z.string().min(2),
  attribution: z.literal("© OpenStreetMap contributors"),
  attributionUrl: z.literal("https://www.openstreetmap.org/copyright"),
  items: z.array(internetTrailResultSchema).max(8),
});
export type InternetTrailSearchResponse = z.infer<
  typeof internetTrailSearchResponseSchema
>;
export const hikeDetailSchema = hikeSummarySchema.extend({
  routes: z.array(routeFeatureSchema).min(1),
});
export type HikeDetail = z.infer<typeof hikeDetailSchema>;
export const hikingStateSchema = z.object({
  observedAt: z.string().datetime(),
  receivedAt: z.string().datetime().optional(),
  source: z.enum(["prototype-static", "weather", "user-input", "system-time"]),
  provenance: z
    .object({
      provider: z.string().min(1),
      license: z.string().min(1),
      attributionUrl: z.string().url(),
    })
    .optional(),
  weather: z.object({
    temperatureF: z.number(),
    windMph: z.number().nonnegative(),
    rainProbability: z.number().min(0).max(1),
  }),
  daylight: z.object({
    sunsetAt: z.string().datetime(),
    remainingMinutes: z.number().int().nonnegative(),
  }),
  user: z.object({
    paceMph: z.number().positive(),
    fatigue: z.enum(["low", "moderate", "high"]),
  }),
});
export type HikingState = z.infer<typeof hikingStateSchema>;
export const environmentalStatusSchema = z.object({
  status: z.enum(["current", "stale", "prototype"]),
  reason: z.enum([
    "observation_current",
    "observation_expired",
    "refresh_failed",
    "prototype_static",
  ]),
  checkedAt: z.string().datetime(),
  staleAfter: z.string().datetime().optional(),
});
export type EnvironmentalStatus = z.infer<typeof environmentalStatusSchema>;
export const createSessionRequestSchema = z.union([
  z.object({
    hikeId: z.string().min(1),
    selectedRouteId: z.string().min(1),
  }),
  z.object({ internetTrail: internetTrailResultSchema }),
]);
export type CreateSessionRequest = z.infer<typeof createSessionRequestSchema>;
const sessionBaseSchema = z.object({
  id: z.string().uuid(),
  hikeId: z.string(),
  selectedRouteId: z.string(),
  createdAt: z.string().datetime(),
  state: hikingStateSchema,
  environmentalStatus: environmentalStatusSchema.optional(),
});
export const sessionSchema = z.discriminatedUnion("status", [
  sessionBaseSchema.extend({ status: z.literal("active") }),
  sessionBaseSchema.extend({
    status: z.literal("ended"),
    endedAt: z.string().datetime(),
  }),
]);
export type Session = z.infer<typeof sessionSchema>;
export const endSessionResponseSchema = z.object({ session: sessionSchema });
export type EndSessionResponse = z.infer<typeof endSessionResponseSchema>;
export const routeSuitabilitySchema = z.object({
  routeId: z.string().min(1),
  suitability: z.number().min(0).max(1),
});
export type RouteSuitability = z.infer<typeof routeSuitabilitySchema>;
export const routeEvaluationSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  status: z.literal("completed"),
  createdAt: z.string().datetime(),
  questionSetVersion: z.literal("route-suitability-v1"),
  provider: z.enum(["openrouter", "jev", "deterministic-baseline"]),
  scores: z.array(routeSuitabilitySchema).min(1),
});
export type RouteEvaluation = z.infer<typeof routeEvaluationSchema>;
const recommendationFactorSchema = z.object({
  label: z.string().min(1),
  value: z.string().min(1),
});
const excludedRouteSchema = z.object({
  routeId: z.string().min(1),
  reasons: z.array(z.string().min(1)).min(1),
});
const recommendedRouteSchema = z.object({
  status: z.literal("recommended").default("recommended"),
  routeId: z.string().min(1),
  suitability: z.number().min(0).max(1),
  policyVersion: z.enum(["highest-suitability-v1", "hard-constraints-v2"]),
  decidedAt: z.string().datetime(),
  explanation: z.string().min(1),
  factors: z.array(recommendationFactorSchema).min(2).max(3),
  excludedRoutes: z.array(excludedRouteSchema).default([]),
});
const unavailableRouteSchema = z.object({
  status: z.literal("unavailable"),
  policyVersion: z.literal("hard-constraints-v2"),
  decidedAt: z.string().datetime(),
  explanation: z.string().min(1),
  factors: z.array(recommendationFactorSchema).min(1).max(3),
  excludedRoutes: z.array(excludedRouteSchema).min(1),
});
export const routeRecommendationSchema = z.union([
  recommendedRouteSchema,
  unavailableRouteSchema,
]);
export type RouteRecommendation = z.infer<typeof routeRecommendationSchema>;
export const latestDecisionSchema = z.object({
  evaluation: routeEvaluationSchema,
  recommendation: routeRecommendationSchema,
});
export type LatestDecision = z.infer<typeof latestDecisionSchema>;
export const sessionStartResponseSchema = latestDecisionSchema.extend({
  session: sessionSchema,
  hike: hikeDetailSchema,
});
export type SessionStartResponse = z.infer<typeof sessionStartResponseSchema>;
export const stateUpdateSourceSchema = z.enum([
  "weather",
  "user-input",
  "system-time",
]);
export const stateChangesSchema = z
  .object({
    temperatureF: z.number().optional(),
    windMph: z.number().nonnegative().optional(),
    rainProbability: z.number().min(0).max(1).optional(),
    remainingMinutes: z.number().int().nonnegative().optional(),
    paceMph: z.number().positive().optional(),
    fatigue: z.enum(["low", "moderate", "high"]).optional(),
  })
  .refine((changes) => Object.keys(changes).length > 0, {
    message: "At least one state change is required",
  });
export const updateSessionStateRequestSchema = z.object({
  observedAt: z.string().datetime(),
  source: stateUpdateSourceSchema,
  changes: stateChangesSchema,
});
export type UpdateSessionStateRequest = z.infer<
  typeof updateSessionStateRequestSchema
>;
export const stateUpdateResponseSchema = z.object({
  accepted: z.literal(true),
  evaluationQueued: z.boolean(),
  reason: z.enum([
    "no_relevant_threshold_crossed",
    "relevant_threshold_crossed",
  ]),
  sequence: z.number().int().positive(),
  crossedThresholds: z.array(z.string()),
  decision: latestDecisionSchema.optional(),
});
export type StateUpdateResponse = z.infer<typeof stateUpdateResponseSchema>;
export const decisionEventSchema = z.object({
  id: z.string().uuid(),
  sessionId: z.string().uuid(),
  sequence: z.number().int().positive(),
  type: z.enum(["session_started", "recommendation_updated"]),
  occurredAt: z.string().datetime(),
  state: hikingStateSchema,
  decision: latestDecisionSchema,
  crossedThresholds: z.array(z.string()),
});
export type DecisionEvent = z.infer<typeof decisionEventSchema>;
export const decisionEventsResponseSchema = z.object({
  items: z.array(decisionEventSchema),
  nextCursor: z.number().int().nonnegative(),
  state: hikingStateSchema,
  environmentalStatus: environmentalStatusSchema,
});
export type DecisionEventsResponse = z.infer<
  typeof decisionEventsResponseSchema
>;
