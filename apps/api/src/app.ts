import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import { createSessionRequestSchema, hikeDetailSchema, hikeSummarySchema, sessionStartResponseSchema, type HikeDetail, type RouteEvaluation, type Session } from "@probably-this-way/contracts";
import { evaluateRoutes } from "./evaluation.js";

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
export async function buildApp() {
  const evaluations = new Map<string, RouteEvaluation>();
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
    evaluations.set(session.id, evaluation);
    return reply.code(201).send(sessionStartResponseSchema.parse({ session, evaluation }));
  });
  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/evaluations/latest", async (request, reply) => {
    const evaluation = evaluations.get(request.params.sessionId);
    if (!evaluation) return reply.code(404).send({ error: { code: "evaluation_not_found", message: "Evaluation not found", details: {} } });
    return evaluation;
  });
  return app;
}
