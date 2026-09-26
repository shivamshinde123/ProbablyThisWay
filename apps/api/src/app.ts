import cors from "@fastify/cors";
import Fastify from "fastify";
import { hikeSummarySchema, type HikeSummary } from "@probably-this-way/contracts";

const hikes: HikeSummary[] = [{ id: "wachusett-summit", name: "Wachusett Summit Circuit", location: "Princeton, Massachusetts", difficulty: "moderate", distanceMiles: 4.2, elevationGainFeet: 1_180 }];

export async function buildApp() {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });
  app.get("/api/v1/health", async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/hikes", async () => ({ items: hikes.map((hike) => hikeSummarySchema.parse(hike)) }));
  return app;
}
