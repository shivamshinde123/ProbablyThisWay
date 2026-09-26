import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import {
  createSessionRequestSchema,
  hikeDetailSchema,
  hikeSummarySchema,
  latestDecisionSchema,
  sessionStartResponseSchema,
  stateUpdateResponseSchema,
  updateSessionStateRequestSchema,
  type HikeDetail,
  type HikingState,
  type LatestDecision,
  type Session,
  type UpdateSessionStateRequest,
} from "@probably-this-way/contracts";
import { evaluateRoutes } from "./evaluation.js";
import { selectRouteRecommendation } from "./policy.js";
import { detectRelevantThresholds } from "./thresholds.js";

const shared = { source: "prototype-seed", dataQuality: "preview" } as const;
const hikeDetails: Record<string, HikeDetail> = {
  "wachusett-summit": {
    id: "wachusett-summit", name: "Wachusett Summit Circuit", location: "Princeton, Massachusetts",
    difficulty: "moderate", distanceMiles: 4.2, elevationGainFeet: 1_180,
    routes: [
      { type: "Feature", geometry: { type: "LineString", coordinates: [[-71.8976,42.4898,310],[-71.8948,42.4932,390],[-71.8908,42.4967,480],[-71.8868,42.5005,574],[-71.8862,42.5031,611]] }, properties: { ...shared, id: "summit-direct", name: "Summit Direct", distanceMiles: 2.1, elevationGainFeet: 1000, estimatedMinutes: 105, exposure: "high" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[-71.8976,42.4898,310],[-71.8994,42.4935,352],[-71.8961,42.4972,430],[-71.8914,42.5002,535],[-71.8862,42.5031,611]] }, properties: { ...shared, id: "balanced-traverse", name: "Balanced Traverse", distanceMiles: 2.7, elevationGainFeet: 1040, estimatedMinutes: 130, exposure: "moderate" } },
      { type: "Feature", geometry: { type: "LineString", coordinates: [[-71.8976,42.4898,310],[-71.9021,42.4918,325],[-71.9030,42.4960,360],[-71.8990,42.4991,420],[-71.8942,42.5010,485]] }, properties: { ...shared, id: "lower-return", name: "Lower Return", distanceMiles: 2.4, elevationGainFeet: 575, estimatedMinutes: 95, exposure: "low" } },
    ],
  },
};

type SessionRecord = {
  session: Session;
  decision: LatestDecision;
  sequence: number;
  lastEvaluatedState: HikingState;
};

function applyStateUpdate(state: HikingState, update: UpdateSessionStateRequest): HikingState {
  const { changes } = update;
  return {
    observedAt: update.observedAt,
    source: update.source,
    weather: {
      temperatureF: changes.temperatureF ?? state.weather.temperatureF,
      windMph: changes.windMph ?? state.weather.windMph,
      rainProbability: changes.rainProbability ?? state.weather.rainProbability,
    },
    daylight: {
      sunsetAt: state.daylight.sunsetAt,
      remainingMinutes: changes.remainingMinutes ?? state.daylight.remainingMinutes,
    },
    user: {
      paceMph: changes.paceMph ?? state.user.paceMph,
      fatigue: changes.fatigue ?? state.user.fatigue,
    },
  };
}

export async function buildApp() {
  const sessions = new Map<string, SessionRecord>();
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  app.get("/api/v1/health", async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/hikes", async () => ({ items: Object.values(hikeDetails).map((hike) => hikeSummarySchema.parse(hike)) }));
  app.get<{ Params: { hikeId: string } }>("/api/v1/hikes/:hikeId", async (request, reply) => {
    const hike = hikeDetails[request.params.hikeId];
    if (!hike) return reply.code(404).send({ error: { code: "hike_not_found", message: "Hike not found", details: {} } });
    return hikeDetailSchema.parse(hike);
  });

  app.post("/api/v1/sessions", async (request, reply) => {
    const parsed = createSessionRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: { code: "invalid_session", message: "Invalid session request", details: parsed.error.flatten() } });
    const hike = hikeDetails[parsed.data.hikeId];
    const route = hike?.routes.find((candidate) => candidate.properties.id === parsed.data.selectedRouteId);
    if (!hike || !route) return reply.code(422).send({ error: { code: "invalid_route", message: "Selected route is not available for this hike", details: {} } });

    const now = new Date();
    const session: Session = {
      id: randomUUID(), hikeId: hike.id, selectedRouteId: route.properties.id, status: "active", createdAt: now.toISOString(),
      state: { observedAt: now.toISOString(), source: "prototype-static", weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 }, daylight: { sunsetAt: new Date(now.getTime() + 159 * 60_000).toISOString(), remainingMinutes: 159 }, user: { paceMph: 2.1, fatigue: "low" } },
    };
    const evaluation = await evaluateRoutes({ sessionId: session.id, state: session.state, routes: hike.routes });
    const recommendation = selectRouteRecommendation(evaluation, hike.routes, session.state);
    const decision = latestDecisionSchema.parse({ evaluation, recommendation });
    sessions.set(session.id, { session, decision, sequence: 0, lastEvaluatedState: session.state });
    return reply.code(201).send(sessionStartResponseSchema.parse({ session, evaluation, recommendation }));
  });

  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId", async (request, reply) => {
    const record = sessions.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });
    return { session: record.session, hike: hikeDetails[record.session.hikeId], decision: record.decision, sequence: record.sequence };
  });

  app.patch<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/state", async (request, reply) => {
    const record = sessions.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });

    const parsed = updateSessionStateRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: { code: "invalid_state_update", message: "Invalid state update", details: parsed.error.flatten() } });
    if (Date.parse(parsed.data.observedAt) <= Date.parse(record.session.state.observedAt)) {
      return reply.code(409).send({ error: { code: "stale_state_update", message: "State update is not newer than the current snapshot", details: {} } });
    }

    const nextState = applyStateUpdate(record.session.state, parsed.data);
    const crossedThresholds = detectRelevantThresholds(record.lastEvaluatedState, nextState);
    record.sequence += 1;
    const sequence = record.sequence;
    record.session = { ...record.session, state: nextState };

    if (crossedThresholds.length === 0) {
      return reply.code(202).send(stateUpdateResponseSchema.parse({
        accepted: true, evaluationQueued: false, reason: "no_relevant_threshold_crossed",
        sequence, crossedThresholds,
      }));
    }

    const hike = hikeDetails[record.session.hikeId];
    if (!hike) throw new Error("Session references an unavailable hike");
    const evaluation = await evaluateRoutes({ sessionId: record.session.id, state: nextState, routes: hike.routes });
    const recommendation = selectRouteRecommendation(evaluation, hike.routes, nextState);
    const decision = latestDecisionSchema.parse({ evaluation, recommendation });

    if (record.sequence === sequence) {
      record.decision = decision;
      record.lastEvaluatedState = nextState;
    }

    return reply.code(202).send(stateUpdateResponseSchema.parse({
      accepted: true, evaluationQueued: true, reason: "relevant_threshold_crossed",
      sequence, crossedThresholds, ...(record.sequence === sequence ? { decision } : {}),
    }));
  });

  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/evaluations/latest", async (request, reply) => {
    const record = sessions.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "evaluation_not_found", message: "Evaluation not found", details: {} } });
    return record.decision;
  });

  return app;
}
