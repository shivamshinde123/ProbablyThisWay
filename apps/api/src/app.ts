import cors from "@fastify/cors";
import Fastify from "fastify";
import { hikeDetailSchema, hikeSummarySchema, type HikeDetail } from "@probably-this-way/contracts";

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
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });
  app.get("/api/v1/health", async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/hikes", async () => ({ items: Object.values(hikeDetails).map((hike) => hikeSummarySchema.parse(hike)) }));
  app.get<{ Params: { hikeId: string } }>("/api/v1/hikes/:hikeId", async (request, reply) => {
    const hike = hikeDetails[request.params.hikeId];
    if (!hike) return reply.code(404).send({ error: { code: "hike_not_found", message: "Hike not found", details: {} } });
    return hikeDetailSchema.parse(hike);
  });
  return app;
}
