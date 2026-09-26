import cors from "@fastify/cors";
import Fastify from "fastify";
import { randomUUID } from "node:crypto";
import {
  createSessionRequestSchema,
  decisionEventSchema,
  decisionEventsResponseSchema,
  hikeDetailSchema,
  hikeSummarySchema,
  latestDecisionSchema,
  sessionStartResponseSchema,
  updateSessionStateRequestSchema,
  type HikeDetail,
  type HikingState,
  type Session,
  type UpdateSessionStateRequest,
} from "@probably-this-way/contracts";
import { isAuthorizedAdapter, resolveAdapterAuthConfig } from "./adapter-auth.js";
import { evaluateRoutes } from "./evaluation.js";
import { selectRouteRecommendation } from "./policy.js";
import { createSessionStore, type SessionStore } from "./session-store.js";
import { transitionSessionState } from "./session-state.js";
import { createWeatherProvider, type WeatherLocation, type WeatherProvider } from "./weather-adapter.js";
import { WeatherRefresher, resolveWeatherRefreshInterval } from "./weather-refresh.js";

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
const hikeWeatherLocations: Record<string, WeatherLocation> = {
  "wachusett-summit": { latitude: 42.4898, longitude: -71.8976 },
};

function applyStateUpdate(state: HikingState, update: UpdateSessionStateRequest): HikingState {
  const { changes } = update;
  return {
    observedAt: update.observedAt,
    receivedAt: new Date().toISOString(),
    source: update.source,
    provenance: state.provenance,
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

export async function buildApp(options: {
  adapterAuthEnv?: NodeJS.ProcessEnv;
  sessionStore?: SessionStore;
  weatherEnv?: NodeJS.ProcessEnv;
  weatherProvider?: WeatherProvider | null;
} = {}) {
  const adapterAuth = resolveAdapterAuthConfig(options.adapterAuthEnv ?? process.env);
  const sessionStore = options.sessionStore ?? createSessionStore(process.env);
  const weatherEnv = options.weatherEnv ?? process.env;
  const weatherProvider = options.weatherProvider === null
    ? undefined
    : options.weatherProvider ?? createWeatherProvider(weatherEnv);
  const liveWeatherRequired = weatherEnv.NODE_ENV === "production";
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: process.env.WEB_ORIGIN ?? "http://localhost:5173" });

  const weatherRefresher = weatherProvider
    ? new WeatherRefresher({
        sessionStore,
        weatherProvider,
        locations: hikeWeatherLocations,
        intervalMs: resolveWeatherRefreshInterval(weatherEnv),
        applySnapshot: async (record, nextState) => {
          const hike = hikeDetails[record.session.hikeId];
          if (!hike) throw new Error("Session references an unavailable hike");
          const result = await transitionSessionState({ record, nextState, hike, sessionStore });
          return result.status;
        },
        onError: (error, context) => {
          app.log.warn({ err: error, ...context }, "Automatic weather refresh failed");
        },
      })
    : undefined;
  weatherRefresher?.start();
  app.addHook("onClose", async () => {
    weatherRefresher?.stop();
    await sessionStore.close();
  });

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
    let state: HikingState = {
      observedAt: now.toISOString(), source: "prototype-static",
      weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
      daylight: { sunsetAt: new Date(now.getTime() + 159 * 60_000).toISOString(), remainingMinutes: 159 },
      user: { paceMph: 2.1, fatigue: "low" },
    };
    if (weatherProvider) {
      try {
        const location = hikeWeatherLocations[hike.id];
        if (!location) throw new Error(`Hike ${hike.id} has no weather location`);
        const environmental = await weatherProvider.getCurrent(location);
        state = { ...environmental, user: state.user };
      } catch (error) {
        request.log.warn({ error, hikeId: hike.id }, "Weather lookup failed");
        if (liveWeatherRequired) {
          return reply.code(503).send({ error: { code: "weather_unavailable", message: "Live weather is temporarily unavailable", details: {} } });
        }
        request.log.warn({ hikeId: hike.id }, "Using prototype-static state outside production");
      }
    }
    const session: Session = {
      id: randomUUID(), hikeId: hike.id, selectedRouteId: route.properties.id, status: "active", createdAt: now.toISOString(),
      state,
    };
    const evaluation = await evaluateRoutes({ sessionId: session.id, state: session.state, routes: hike.routes });
    const recommendation = selectRouteRecommendation(evaluation, hike.routes, session.state);
    const decision = latestDecisionSchema.parse({ evaluation, recommendation });
    const initialEvent = decisionEventSchema.parse({
      id: randomUUID(), sessionId: session.id, sequence: 1, type: "session_started",
      occurredAt: decision.recommendation.decidedAt, state: session.state, decision, crossedThresholds: [],
    });
    await sessionStore.create({
      session, decision, sequence: 0, lastEvaluatedState: session.state,
      eventSequence: 1, events: [initialEvent],
    });
    return reply.code(201).send(sessionStartResponseSchema.parse({ session, evaluation, recommendation }));
  });

  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId", async (request, reply) => {
    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });
    return { session: record.session, hike: hikeDetails[record.session.hikeId], decision: record.decision, sequence: record.sequence };
  });

  app.patch<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/state", async (request, reply) => {
    if (!isAuthorizedAdapter(request.headers.authorization, adapterAuth)) {
      return reply
        .header("www-authenticate", 'Bearer realm="state-adapter"')
        .code(401)
        .send({ error: { code: "adapter_unauthorized", message: "Valid adapter credentials are required", details: {} } });
    }

    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });

    const parsed = updateSessionStateRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(422).send({ error: { code: "invalid_state_update", message: "Invalid state update", details: parsed.error.flatten() } });
    const nextState = applyStateUpdate(record.session.state, parsed.data);
    const hike = hikeDetails[record.session.hikeId];
    if (!hike) throw new Error("Session references an unavailable hike");
    const result = await transitionSessionState({ record, nextState, hike, sessionStore });
    if (result.status === "stale") {
      return reply.code(409).send({ error: { code: "stale_state_update", message: "State update is not newer than the current snapshot", details: {} } });
    }
    if (result.status === "conflict") {
      return reply.code(409).send({ error: { code: "state_update_conflict", message: "Session state changed; retry with a newer observation", details: {} } });
    }
    return reply.code(202).send(result.response);
  });

  app.get<{ Params: { sessionId: string }; Querystring: { after?: string } }>("/api/v1/sessions/:sessionId/events", async (request, reply) => {
    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });

    const after = request.query.after === undefined ? 0 : Number(request.query.after);
    if (!Number.isSafeInteger(after) || after < 0) {
      return reply.code(422).send({ error: { code: "invalid_cursor", message: "Event cursor must be a non-negative integer", details: {} } });
    }

    const items = record.events.filter((event) => event.sequence > after);
    const nextCursor = items.at(-1)?.sequence ?? after;
    return decisionEventsResponseSchema.parse({ items, nextCursor });
  });
  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/evaluations/latest", async (request, reply) => {
    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "evaluation_not_found", message: "Evaluation not found", details: {} } });
    return record.decision;
  });

  return app;
}
