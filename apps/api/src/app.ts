import cors from "@fastify/cors";
import rateLimit from "@fastify/rate-limit";
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
  type HikingState,
  type Session,
  type UpdateSessionStateRequest,
} from "@probably-this-way/contracts";
import { isAuthorizedAdapter, resolveAdapterAuthConfig } from "./adapter-auth.js";
import { evaluateRoutes } from "./evaluation.js";
import { selectRouteRecommendation } from "./policy.js";
import { createSessionStore, type SessionStore } from "./session-store.js";
import { transitionSessionState, updateEnvironmentalStatus } from "./session-state.js";
import {
  DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS,
  currentEnvironmentalStatus,
  failedEnvironmentalStatus,
  prototypeEnvironmentalStatus,
  resolveEnvironmentalStatus,
  resolveWeatherFreshnessMaxAge,
} from "./environmental-status.js";
import { createWeatherProvider, type WeatherProvider } from "./weather-adapter.js";
import { hikeDetails, hikeWeatherLocations } from "./route-catalog.js";
import { WeatherRefresher, resolveWeatherRefreshInterval } from "./weather-refresh.js";
import { resolveOperationalConfig } from "./operational-config.js";
import { RetentionSweeper, resolveRetentionConfig } from "./retention.js";

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
  operationalEnv?: NodeJS.ProcessEnv;
} = {}) {
  const adapterAuth = resolveAdapterAuthConfig(options.adapterAuthEnv ?? process.env);
  const sessionStore = options.sessionStore ?? createSessionStore(process.env);
  const weatherEnv = options.weatherEnv ?? process.env;
  const operationalEnv = options.operationalEnv ?? process.env;
  const operational = resolveOperationalConfig(operationalEnv);
  const retention = resolveRetentionConfig(operationalEnv);
  const weatherProvider = options.weatherProvider === null
    ? undefined
    : options.weatherProvider ?? createWeatherProvider(weatherEnv);
  const liveWeatherRequired = weatherEnv.NODE_ENV === "production";
  const weatherRefreshInterval = weatherProvider ? resolveWeatherRefreshInterval(weatherEnv) : undefined;
  const weatherFreshnessMaxAge = weatherProvider
    ? resolveWeatherFreshnessMaxAge(weatherEnv, weatherRefreshInterval)
    : DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS;
  const app = Fastify({ logger: { level: operational.logLevel }, trustProxy: operational.trustProxy });
  await app.register(cors, { origin: operational.allowedOrigins });
  await app.register(rateLimit, {
    global: true,
    max: operational.rateLimitMax,
    timeWindow: operational.rateLimitWindowMs,
  });

  const weatherRefresher = weatherProvider
    ? new WeatherRefresher({
        sessionStore,
        weatherProvider,
        locations: hikeWeatherLocations,
        intervalMs: weatherRefreshInterval!,
        applySnapshot: async (record, nextState) => {
          const hike = hikeDetails[record.session.hikeId];
          if (!hike) throw new Error("Session references an unavailable hike");
          const environmentalStatus = currentEnvironmentalStatus(nextState, weatherFreshnessMaxAge);
          record.session = { ...record.session, environmentalStatus };
          const result = await transitionSessionState({ record, nextState, hike, sessionStore });
          if (result.status !== "stale") return result.status;
          return updateEnvironmentalStatus({
            record, environmentalStatus, sessionStore, receivedAt: nextState.receivedAt,
          });
        },
        onSessionError: async (record) => {
          const environmentalStatus = failedEnvironmentalStatus(
            record.session.environmentalStatus,
            new Date().toISOString(),
          );
          const result = await updateEnvironmentalStatus({ record, environmentalStatus, sessionStore });
          if (result === "conflict") throw new Error("Environmental status changed concurrently");
        },
        onError: (error, context) => {
          app.log.warn({ err: error, ...context }, "Automatic weather refresh failed");
        },
      })
    : undefined;
  weatherRefresher?.start();
  const retentionSweeper = new RetentionSweeper({
    sessionStore,
    ...retention,
    onError: (error) => app.log.warn({ err: error }, "Retention sweep failed"),
  });
  retentionSweeper.start();
  app.addHook("onClose", async () => {
    weatherRefresher?.stop();
    retentionSweeper.stop();
    await sessionStore.close();
  });

  const healthRouteOptions = { config: { rateLimit: false } } as const;
  app.get("/api/v1/health", healthRouteOptions, async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/health/live", healthRouteOptions, async () => ({ service: "probably-this-way-api", status: "ok" }));
  app.get("/api/v1/health/ready", healthRouteOptions, async (_request, reply) => {
    try {
      await sessionStore.readiness();
      return { service: "probably-this-way-api", status: "ready" };
    } catch (error) {
      app.log.error({ err: error }, "Readiness check failed");
      return reply.code(503).send({ service: "probably-this-way-api", status: "unavailable" });
    }
  });
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
      observedAt: now.toISOString(), receivedAt: now.toISOString(), source: "prototype-static",
      weather: { temperatureF: 54, windMph: 8, rainProbability: 0.18 },
      daylight: { sunsetAt: new Date(now.getTime() + 159 * 60_000).toISOString(), remainingMinutes: 159 },
      user: { paceMph: 2.1, fatigue: "low" },
    };
    let environmentalStatus = prototypeEnvironmentalStatus(now.toISOString());
    if (weatherProvider) {
      try {
        const location = hikeWeatherLocations[hike.id];
        if (!location) throw new Error(`Hike ${hike.id} has no weather location`);
        const environmental = await weatherProvider.getCurrent(location);
        state = { ...environmental, user: state.user };
        environmentalStatus = currentEnvironmentalStatus(state, weatherFreshnessMaxAge);
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
      state, environmentalStatus,
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
    const environmentalStatus = resolveEnvironmentalStatus(
      record.session.environmentalStatus, record.session.state, weatherFreshnessMaxAge,
    );
    return { session: { ...record.session, environmentalStatus }, hike: hikeDetails[record.session.hikeId], decision: record.decision, sequence: record.sequence };
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
    if (parsed.data.source === "weather") {
      record.session = {
        ...record.session,
        environmentalStatus: currentEnvironmentalStatus(nextState, weatherFreshnessMaxAge),
      };
    }
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

  app.get<{ Params: { sessionId: string }; Querystring: { after?: string; limit?: string } }>("/api/v1/sessions/:sessionId/events", async (request, reply) => {
    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "session_not_found", message: "Session not found", details: {} } });

    const after = request.query.after === undefined ? 0 : Number(request.query.after);
    if (!Number.isSafeInteger(after) || after < 0) {
      return reply.code(422).send({ error: { code: "invalid_cursor", message: "Event cursor must be a non-negative integer", details: {} } });
    }

    const limit = request.query.limit === undefined ? operational.eventPageSize : Number(request.query.limit);
    if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) {
      return reply.code(422).send({ error: { code: "invalid_limit", message: "Event limit must be an integer from 1 to 100", details: {} } });
    }

    const items = record.events.filter((event) => event.sequence > after).slice(0, limit);
    const nextCursor = items.at(-1)?.sequence ?? after;
    const environmentalStatus = resolveEnvironmentalStatus(
      record.session.environmentalStatus, record.session.state, weatherFreshnessMaxAge,
    );
    return decisionEventsResponseSchema.parse({
      items, nextCursor, state: record.session.state, environmentalStatus,
    });
  });
  app.get<{ Params: { sessionId: string } }>("/api/v1/sessions/:sessionId/evaluations/latest", async (request, reply) => {
    const record = await sessionStore.get(request.params.sessionId);
    if (!record) return reply.code(404).send({ error: { code: "evaluation_not_found", message: "Evaluation not found", details: {} } });
    return record.decision;
  });

  return app;
}
