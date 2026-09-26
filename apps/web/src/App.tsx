import { lazy, Suspense, useEffect, useState } from "react";
import {
  createSessionRequestSchema,
  decisionEventsResponseSchema,
  endSessionResponseSchema,
  hikeDetailSchema,
  hikesResponseSchema,
  sessionStartResponseSchema,
  type DecisionEvent,
  type HikeDetail,
  type InternetTrailResult,
  type RouteEvaluation,
  type RouteFeature,
  type RouteRecommendation,
  type Session,
} from "@probably-this-way/contracts";
import { DecisionFeed } from "./components/DecisionFeed";
import { RecommendationBanner } from "./components/RecommendationBanner";
import { SessionHud } from "./components/SessionHud";
import { TrailSearch } from "./components/TrailSearch";

const TerrainMap = lazy(() =>
  import("./components/TerrainMap").then((module) => ({
    default: module.TerrainMap,
  })),
);
const apiBaseUrl =
  import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

const isRouteBlocked = (route: RouteFeature) =>
  route.properties.legalStatus === "illegal" ||
  route.properties.accessStatus === "closed" ||
  route.properties.accessStatus === "restricted" ||
  route.properties.restrictions.some(
    (restriction) => restriction.kind === "prohibitive",
  );

export function App() {
  const [catalogHike, setCatalogHike] = useState<HikeDetail>();
  const [hike, setHike] = useState<HikeDetail>();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [internetTrail, setInternetTrail] = useState<InternetTrailResult>();
  const [session, setSession] = useState<Session>();
  const [evaluation, setEvaluation] = useState<RouteEvaluation>();
  const [recommendation, setRecommendation] = useState<RouteRecommendation>();
  const [events, setEvents] = useState<DecisionEvent[]>([]);
  const [feedStatus, setFeedStatus] = useState<
    "idle" | "syncing" | "live" | "degraded"
  >("idle");
  const [status, setStatus] = useState<
    "loading" | "ready" | "starting" | "ending" | "error"
  >("loading");
  const sessionId = session?.id;

  useEffect(() => {
    const controller = new AbortController();
    async function loadHike() {
      try {
        const listResponse = await fetch(apiBaseUrl + "/hikes", {
          signal: controller.signal,
        });
        if (!listResponse.ok)
          throw new Error("Catalog returned " + listResponse.status);
        const selected = hikesResponseSchema.parse(await listResponse.json())
          .items[0];
        if (!selected) throw new Error("Hike catalog is empty");

        const detailResponse = await fetch(
          apiBaseUrl + "/hikes/" + selected.id,
          { signal: controller.signal },
        );
        if (!detailResponse.ok)
          throw new Error("Hike detail returned " + detailResponse.status);
        const detail = hikeDetailSchema.parse(await detailResponse.json());
        setCatalogHike(detail);
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
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

    async function pollEvents() {
      try {
        const response = await fetch(
          apiBaseUrl + "/sessions/" + sessionId + "/events?after=" + cursor,
          { signal: controller.signal },
        );
        if (!response.ok) throw new Error("Events returned " + response.status);
        const batch = decisionEventsResponseSchema.parse(await response.json());
        cursor = batch.nextCursor;
        setSession((current) => {
          if (!current || current.id !== sessionId) return current;
          const currentStatus = current.environmentalStatus;
          const unchanged =
            current.state.observedAt === batch.state.observedAt &&
            current.state.receivedAt === batch.state.receivedAt &&
            currentStatus?.status === batch.environmentalStatus.status &&
            currentStatus?.reason === batch.environmentalStatus.reason &&
            currentStatus?.checkedAt === batch.environmentalStatus.checkedAt;
          if (unchanged) return current;
          return {
            ...current,
            state: batch.state,
            environmentalStatus: batch.environmentalStatus,
          };
        });

        if (batch.items.length > 0) {
          setEvents((current) => {
            const knownIds = new Set(current.map((event) => event.id));
            return [
              ...current,
              ...batch.items.filter((event) => !knownIds.has(event.id)),
            ];
          });
          const latest = batch.items.at(-1);
          if (latest) {
            setEvaluation(latest.decision.evaluation);
            setRecommendation(latest.decision.recommendation);
          }
        }
        setFeedStatus("live");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
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
    if ((!hike || !selectedRouteId) && !internetTrail) return;
    setStatus("starting");
    try {
      const request = createSessionRequestSchema.parse(
        internetTrail
          ? { internetTrail }
          : { hikeId: hike?.id, selectedRouteId },
      );
      const response = await fetch(apiBaseUrl + "/sessions", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!response.ok) throw new Error("Session returned " + response.status);
      const started = sessionStartResponseSchema.parse(await response.json());
      setEvents([]);
      setFeedStatus("syncing");
      setSession(started.session);
      setHike(started.hike);
      setSelectedRouteId(started.session.selectedRouteId);
      setInternetTrail(undefined);
      setEvaluation(started.evaluation);
      setRecommendation(started.recommendation);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }

  async function endSession() {
    if (!session) return;
    setStatus("ending");
    try {
      const response = await fetch(
        apiBaseUrl + "/sessions/" + session.id + "/end",
        { method: "POST" },
      );
      if (!response.ok)
        throw new Error("End session returned " + response.status);
      endSessionResponseSchema.parse(await response.json());
      setSession(undefined);
      setEvaluation(undefined);
      setRecommendation(undefined);
      setHike(undefined);
      setSelectedRouteId(undefined);
      setInternetTrail(undefined);
      setEvents([]);
      setFeedStatus("idle");
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }
  const routes = hike?.routes ?? [];
  const scoresByRoute = new Map(
    evaluation?.scores.map((score) => [score.routeId, score]),
  );
  const recommendedRouteId =
    recommendation?.status === "recommended"
      ? recommendation.routeId
      : undefined;
  const recommendedRoute = routes.find(
    (route) => route.properties.id === recommendedRouteId,
  );
  const excludedRouteIds = new Set(
    recommendation?.excludedRoutes.map((route) => route.routeId) ?? [],
  );
  const isEvaluating = status === "starting";
  const isEnding = status === "ending";
  let sessionLabel = "Field system · standby";
  if (session) sessionLabel = "Session active";
  if (recommendation)
    sessionLabel =
      recommendation.status === "recommended"
        ? "Recommendation ready"
        : "No eligible route";

  return (
    <main className="app-shell">
      <header className="masthead">
        <a className="wordmark" href="/" aria-label="ProbablyThisWay home">
          <span className="waymark">PTW</span>
          <span>ProbablyThisWay</span>
        </a>
        <div className="session-state" data-ready={Boolean(recommendation)}>
          <span /> {sessionLabel}
        </div>
      </header>
      <section className="hero-grid" data-panel-collapsed={sidebarCollapsed}>
        <div className="map-stage" aria-busy={isEvaluating}>
          <Suspense
            fallback={
              <div className="map-loading">Loading terrain engine…</div>
            }
          >
            <TerrainMap
              routes={routes}
              selectedRouteId={selectedRouteId}
              recommendedRouteId={recommendedRouteId}
              recommendationSuitability={
                recommendation?.status === "recommended"
                  ? recommendation.suitability
                  : undefined
              }
              internetTrail={internetTrail}
            />
          </Suspense>
          {isEvaluating ? (
            <div className="decision-progress" role="status">
              <span />
              <div>
                <strong>Evaluating route fit</strong>
                <small>State + alternatives → policy</small>
              </div>
            </div>
          ) : null}
          {session ? <SessionHud session={session} /> : null}
          <button
            className="sidebar-toggle"
            type="button"
            aria-expanded={!sidebarCollapsed}
            aria-controls="trail-control-panel"
            onClick={() => setSidebarCollapsed((collapsed) => !collapsed)}
          >
            {sidebarCollapsed ? "Open trail panel" : "Collapse trail panel"}
            <span aria-hidden="true">{sidebarCollapsed ? "←" : "→"}</span>
          </button>
        </div>
        <aside
          id="trail-control-panel"
          className="mission-panel"
          aria-busy={isEvaluating}
          aria-hidden={sidebarCollapsed}
        >
          <p className="eyebrow">Route intelligence / final</p>
          <h1>
            Let the signal
            <br />
            <em>mark the way.</em>
          </h1>
          <p className="lede">
            Every valid route is measured against one shared state. The result
            stays explainable, visibly sourced, and separate from official trail
            guidance.
          </p>
          <TrailSearch
            apiBaseUrl={apiBaseUrl}
            hike={catalogHike}
            selectedRouteId={selectedRouteId}
            selectedInternetTrailId={internetTrail?.id}
            disabled={isEvaluating}
            onSelectRoute={(routeId) => {
              setInternetTrail(undefined);
              setHike(catalogHike);
              setSelectedRouteId(routeId);
            }}
            onSelectInternetTrail={(trail) => {
              setHike(undefined);
              setSelectedRouteId(undefined);
              setInternetTrail(trail);
            }}
          />
          <div className="trail-card" aria-live="polite">
            {status === "loading" ? (
              <p className="system-message">Reading route catalog…</p>
            ) : null}
            {status === "error" ? (
              <p className="system-message error">
                The latest request failed. Check the local API and try again.
              </p>
            ) : null}
            {internetTrail ? (
              <>
                <div className="trail-heading">
                  <div>
                    <small>Internet trail preview</small>
                    <h2>{internetTrail.name}</h2>
                  </div>
                  <span className="difficulty">OSM</span>
                </div>
                <p className="location">{internetTrail.location}</p>
                <p className="route-source">
                  <a
                    href={internetTrail.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Open trail in OpenStreetMap
                  </a>
                  <span>
                    {internetTrail.distanceMiles.toFixed(2)} mapped mi
                  </span>
                </p>
                <p className="internet-preview-note">
                  Mapped geometry with unverified access and elevation. Start
                  this trail to request a structured route evaluation.
                </p>
              </>
            ) : hike ? (
              <>
                <div className="trail-heading">
                  <div>
                    <small>Selected hike</small>
                    <h2>{hike.name}</h2>
                  </div>
                  <span className="difficulty">{hike.difficulty}</span>
                </div>
                <p className="location">{hike.location}</p>
                <p className="route-source">
                  <a
                    href={hike.routes[0]?.properties.sourceUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {hike.id.startsWith("internet-")
                      ? "OpenStreetMap trail geometry"
                      : "Massachusetts DCR trail geometry"}
                  </a>
                  <span>
                    Dataset updated{" "}
                    {new Date(
                      hike.routes[0]?.properties.datasetUpdatedAt ?? "",
                    ).toLocaleDateString("en-US", {
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                </p>
              </>
            ) : status === "ready" ? (
              <div className="search-empty">
                <span>01</span>
                <div>
                  <strong>Search for your trail</strong>
                  <p>
                    Enter a trail name plus city and state, then select the
                    mapped result you want to analyze.
                  </p>
                </div>
              </div>
            ) : null}
          </div>
          {evaluation ? (
            <section
              className="model-response"
              aria-labelledby="model-response-title"
            >
              <div className="model-response-heading">
                <div>
                  <span>Model response</span>
                  <h2 id="model-response-title">
                    {evaluation.provider === "openrouter"
                      ? "OpenRouter structured scores"
                      : evaluation.provider === "jev"
                        ? "Legacy Jev structured scores"
                        : "Deterministic fallback scores"}
                  </h2>
                </div>
                <strong>
                  {evaluation.scores.length} route
                  {evaluation.scores.length === 1 ? "" : "s"} evaluated
                </strong>
              </div>
              <p className="model-response-note">
                {evaluation.provider === "openrouter"
                  ? "OpenRouter scored every mapped candidate. Application policy selected the highest eligible route."
                  : "OpenRouter was not configured or did not return a valid response, so the local auditable baseline scored these routes."}
              </p>
              <div
                className="route-options"
                aria-label="Evaluated route scores"
              >
                {routes.map((route, index) => {
                  const active = route.properties.id === selectedRouteId;
                  const isRecommended =
                    route.properties.id === recommendedRouteId;
                  const isExcluded =
                    excludedRouteIds.has(route.properties.id) ||
                    isRouteBlocked(route);
                  const score = scoresByRoute.get(route.properties.id);
                  return (
                    <article
                      key={route.properties.id}
                      className="route-option"
                      data-active={active}
                      data-recommended={isRecommended}
                      data-excluded={isExcluded}
                    >
                      <span className="route-index">
                        {String(index + 1).padStart(2, "0")}
                      </span>
                      <span className="route-copy">
                        <strong>
                          {route.properties.name}
                          {isRecommended ? (
                            <small className="recommended-tag">Chosen</small>
                          ) : null}
                        </strong>
                        <small>
                          {route.properties.distanceMiles} mi ·{" "}
                          {route.properties.estimatedMinutes} min · access{" "}
                          {route.properties.accessStatus}
                        </small>
                      </span>
                      {isExcluded ? (
                        <span className="route-excluded">Excluded</span>
                      ) : score ? (
                        <span className="suitability">
                          <b>{Math.round(score.suitability * 100)}</b>
                          <small>% fit</small>
                        </span>
                      ) : null}
                    </article>
                  );
                })}
              </div>
              {recommendation ? (
                <RecommendationBanner
                  routeName={recommendedRoute?.properties.name}
                  recommendation={recommendation}
                />
              ) : null}
              <p className="evaluation-source">
                Question set {evaluation.questionSetVersion} · provider{" "}
                {evaluation.provider}
              </p>
            </section>
          ) : internetTrail || selectedRouteId ? (
            <p className="model-awaiting">
              Start this trail to request structured route scores and a visible
              recommendation.
            </p>
          ) : null}
          {session ? (
            <DecisionFeed events={events} status={feedStatus} />
          ) : null}
          {session ? (
            <button
              className="secondary-action"
              type="button"
              disabled={isEnding}
              onClick={() => void endSession()}
              aria-describedby="safety-note"
            >
              {isEnding ? "Ending field session…" : "End field session"}
              <span>×</span>
            </button>
          ) : (
            <button
              className="primary-action"
              type="button"
              disabled={(!selectedRouteId && !internetTrail) || isEvaluating}
              onClick={() => void startSession()}
              aria-describedby="safety-note"
            >
              {isEvaluating
                ? "Evaluating routes…"
                : internetTrail
                  ? "Analyze & start this trail"
                  : "Analyze & start trail"}
              <span>↗</span>
            </button>
          )}
          <p className="safety-note" id="safety-note">
            <strong>Decision support, not a safety guarantee.</strong> Check
            current DCR notices and posted closures before entering a trail.
          </p>
        </aside>
      </section>
    </main>
  );
}
