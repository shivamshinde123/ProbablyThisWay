import { lazy, Suspense, useEffect, useState } from "react";
import {
  createSessionRequestSchema,
  decisionEventsResponseSchema,
  hikeDetailSchema,
  hikesResponseSchema,
  sessionStartResponseSchema,
  type DecisionEvent,
  type HikeDetail,
  type RouteEvaluation,
  type RouteRecommendation,
  type Session,
} from "@probably-this-way/contracts";
import { DecisionFeed } from "./components/DecisionFeed";
import { RecommendationBanner } from "./components/RecommendationBanner";
import { SessionHud } from "./components/SessionHud";

const TerrainMap = lazy(() => import("./components/TerrainMap").then((module) => ({ default: module.TerrainMap })));
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

export function App() {
  const [hike, setHike] = useState<HikeDetail>();
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [session, setSession] = useState<Session>();
  const [evaluation, setEvaluation] = useState<RouteEvaluation>();
  const [recommendation, setRecommendation] = useState<RouteRecommendation>();
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<"idle" | "syncing" | "live" | "degraded">("idle");
  const [status, setStatus] = useState<"loading" | "ready" | "starting" | "error">("loading");
  const sessionId = session?.id;

  useEffect(() => {
    const controller = new AbortController();
    async function loadHike() {
      try {
        const listResponse = await fetch(apiBaseUrl + "/hikes", { signal: controller.signal });
        if (!listResponse.ok) throw new Error("Catalog returned " + listResponse.status);
        const selected = hikesResponseSchema.parse(await listResponse.json()).items[0];
        if (!selected) throw new Error("Hike catalog is empty");

        const detailResponse = await fetch(apiBaseUrl + "/hikes/" + selected.id, { signal: controller.signal });
        if (!detailResponse.ok) throw new Error("Hike detail returned " + detailResponse.status);
        const detail = hikeDetailSchema.parse(await detailResponse.json());
        setHike(detail);
        setSelectedRouteId(detail.routes[0]?.properties.id);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }

    void loadHike();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!sessionId) return;

    const controller = new AbortController();
    let cursor = 0;
    let stopped = false;
    let timer: number | undefined;
    setFeedStatus("syncing");

    async function pollEvents() {
      try {
        const response = await fetch(apiBaseUrl + "/sessions/" + sessionId + "/events?after=" + cursor, { signal: controller.signal });
        if (!response.ok) throw new Error("Events returned " + response.status);
        const batch = decisionEventsResponseSchema.parse(await response.json());
        cursor = batch.nextCursor;

        if (batch.items.length > 0) {
          setEvents((current) => {
            const knownIds = new Set(current.map((event) => event.id));
            return [...current, ...batch.items.filter((event) => !knownIds.has(event.id))];
          });
          const latest = batch.items.at(-1);
          if (latest) {
            setSession((current) => {
              if (!current || current.id !== sessionId) return current;
              return { ...current, state: latest.state };
            });
            setEvaluation(latest.decision.evaluation);
            setRecommendation(latest.decision.recommendation);
          }
        }
        setFeedStatus("live");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFeedStatus("degraded");
      } finally {
        if (!stopped) timer = window.setTimeout(() => void pollEvents(), 5_000);
      }
    }

    void pollEvents();
    return () => {
      stopped = true;
      controller.abort();
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [sessionId]);

  async function startSession() {
    if (!hike || !selectedRouteId) return;
    setStatus("starting");
    try {
      const request = createSessionRequestSchema.parse({ hikeId: hike.id, selectedRouteId });
      const response = await fetch(apiBaseUrl + "/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error("Session returned " + response.status);
      const started = sessionStartResponseSchema.parse(await response.json());
      setEvents([]);
      setSession(started.session);
      setEvaluation(started.evaluation);
      setRecommendation(started.recommendation);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  const routes = hike?.routes ?? [];
  const scoresByRoute = new Map(evaluation?.scores.map((score) => [score.routeId, score]));
  const recommendedRoute = routes.find((route) => route.properties.id === recommendation?.routeId);
  const isEvaluating = status === "starting";

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="ProbablyThisWay home"><span className="waymark">PTW</span><span>ProbablyThisWay</span></a>
        <div className="session-state" data-ready={Boolean(recommendation)}><span /> {recommendation ? "Recommendation ready" : session ? "Session active" : "Field system · standby"}</div>
      </header>
      <section className="hero-grid">
        <div className="map-stage" aria-busy={isEvaluating}>
          <Suspense fallback={<div className="map-loading">Loading terrain engine…</div>}>
            <TerrainMap routes={routes} selectedRouteId={selectedRouteId} recommendedRouteId={recommendation?.routeId} recommendationSuitability={recommendation?.suitability} />
          </Suspense>
          {isEvaluating ? <div className="decision-progress" role="status"><span /><div><strong>Evaluating route fit</strong><small>State + alternatives → policy</small></div></div> : null}
          {session ? <SessionHud session={session} /> : null}
        </div>
        <aside className="mission-panel" aria-busy={isEvaluating}>
          <p className="eyebrow">Route intelligence / final</p>
          <h1>Let the signal<br /><em>mark the way.</em></h1>
          <p className="lede">Every valid route is measured against one shared state. The result stays explainable, visibly sourced, and separate from official trail guidance.</p>
          <div className="trail-card" aria-live="polite">
            {status === "loading" ? <p className="system-message">Reading route catalog…</p> : null}
            {status === "error" ? <p className="system-message error">The latest request failed. Check the local API and try again.</p> : null}
            {hike ? <><div className="trail-heading"><div><small>Selected hike</small><h2>{hike.name}</h2></div><span className="difficulty">{hike.difficulty}</span></div><p className="location">{hike.location}</p></> : null}
          </div>
          <div className="route-options" aria-label="Route alternatives">
            {routes.map((route, index) => {
              const active = route.properties.id === selectedRouteId;
              const isRecommended = route.properties.id === recommendation?.routeId;
              const score = scoresByRoute.get(route.properties.id);
              return (
                <button key={route.properties.id} type="button" className="route-option" data-active={active} data-recommended={isRecommended} aria-pressed={active} disabled={Boolean(session) || isEvaluating} onClick={() => setSelectedRouteId(route.properties.id)}>
                  <span className="route-index">0{index + 1}</span>
                  <span className="route-copy"><strong>{route.properties.name}{isRecommended ? <small className="recommended-tag">Recommended</small> : null}</strong><small>{route.properties.distanceMiles} mi · +{route.properties.elevationGainFeet.toLocaleString("en-US")} ft · {route.properties.estimatedMinutes} min</small></span>
                  {score ? <span className="suitability"><b>{Math.round(score.suitability * 100)}</b><small>% fit</small></span> : <span className={"exposure exposure-" + route.properties.exposure}>{route.properties.exposure}</span>}
                </button>
              );
            })}
          </div>
          {recommendation && recommendedRoute ? <RecommendationBanner routeName={recommendedRoute.properties.name} recommendation={recommendation} /> : null}
          {evaluation ? <p className="evaluation-source">Question set {evaluation.questionSetVersion} · {evaluation.provider === "jev" ? "Jev evaluation" : "deterministic baseline"}</p> : null}
          {session ? <DecisionFeed events={events} status={feedStatus} /> : null}
          <button className="primary-action" type="button" disabled={!selectedRouteId || isEvaluating || Boolean(session)} onClick={() => void startSession()} aria-describedby="safety-note">
            {isEvaluating ? "Evaluating routes…" : session ? "Session active" : "Start field session"}<span>↗</span>
          </button>
          <p className="safety-note" id="safety-note"><strong>Decision support, not a safety guarantee.</strong> Prototype inputs are not verified current field observations.</p>
        </aside>
      </section>
    </main>
  );
}
