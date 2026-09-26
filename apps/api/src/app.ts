import cors from "@fastify/cors";
import Fastify from "fastify";
import { hikeDetailSchema, hikeSummarySchema, type HikeDetail } from "@probably-this-way/contracts";

const hikeDetails: Record<string, HikeDetail> = {
  "wachusett-summit": {
    id: "wachusett-summit",
    name: "Wachusett Summit Circuit",
    location: "Princeton, Massachusetts",
    difficulty: "moderate",
    distanceMiles: 4.2,
    elevationGainFeet: 1_180,
    trails: [{
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: [
          [-71.8976, 42.4898, 310],
          [-71.8948, 42.4932, 390],
          [-71.8908, 42.4967, 480],
          [-71.8868, 42.5005, 574],
          [-71.8862, 42.5031, 611],
        ],
      },
      properties: {
        id: "wachusett-preview-line",
        name: "Summit approach preview",
        source: "prototype-seed",
        dataQuality: "preview",
      },
    }],
  },
};

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  app.get("/api/v1/health", async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/hikes", async () => ({
    items: Object.values(hikeDetails).map((hike) => hikeSummarySchema.parse(hike)),
  }));
  app.get<{ Params: { hikeId: string } }>("/api/v1/hikes/:hikeId", async (request, reply) => {
    const hike = hikeDetails[request.params.hikeId];
    if (!hike) return reply.code(404).send({ error: { code: "hike_not_found", message: "Hike not found", details: {} } });
    return hikeDetailSchema.parse(hike);
  });

  return app;
}
