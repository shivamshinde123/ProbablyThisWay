import { lazy, Suspense, useEffect, useState } from "react";
import { createSessionRequestSchema, hikeDetailSchema, hikesResponseSchema, sessionSchema, type HikeDetail, type Session } from "@probably-this-way/contracts";
import { SessionHud } from "./components/SessionHud";

const TerrainMap = lazy(() => import("./components/TerrainMap").then((module) => ({ default: module.TerrainMap })));
const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

export function App() {
  const [hike, setHike] = useState<HikeDetail>();
  const [selectedRouteId, setSelectedRouteId] = useState<string>();
  const [session, setSession] = useState<Session>();
  const [status, setStatus] = useState<"loading" | "ready" | "starting" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function loadHike() {
      try {
        const listResponse = await fetch(`${apiBaseUrl}/hikes`, { signal: controller.signal });
        if (!listResponse.ok) throw new Error(`Catalog returned ${listResponse.status}`);
        const selected = hikesResponseSchema.parse(await listResponse.json()).items[0];
        if (!selected) throw new Error("Hike catalog is empty");
        const detailResponse = await fetch(`${apiBaseUrl}/hikes/${selected.id}`, { signal: controller.signal });
        if (!detailResponse.ok) throw new Error(`Hike detail returned ${detailResponse.status}`);
        const detail = hikeDetailSchema.parse(await detailResponse.json());
        setHike(detail); setSelectedRouteId(detail.routes[0]?.properties.id); setStatus("ready");
      } catch (error) { if (error instanceof DOMException && error.name === "AbortError") return; setStatus("error"); }
    }
    void loadHike(); return () => controller.abort();
  }, []);

  async function startSession() {
    if (!hike || !selectedRouteId) return;
    setStatus("starting");
    try {
      const request = createSessionRequestSchema.parse({ hikeId: hike.id, selectedRouteId });
      const response = await fetch(`${apiBaseUrl}/sessions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(request) });
      if (!response.ok) throw new Error(`Session returned ${response.status}`);
      setSession(sessionSchema.parse(await response.json())); setStatus("ready");
    } catch { setStatus("error"); }
  }

  const routes = hike?.routes ?? [];
  return <main className="app-shell">
    <header className="masthead"><a className="wordmark" href="/" aria-label="ProbablyThisWay home"><span className="waymark">PTW</span><span>ProbablyThisWay</span></a><div className="session-state"><span /> {session ? "Session active" : "Field system · standby"}</div></header>
    <section className="hero-grid"><div className="map-stage"><Suspense fallback={<div className="map-loading">Loading terrain engine…</div>}><TerrainMap routes={routes} selectedRouteId={selectedRouteId}/></Suspense>{session ? <SessionHud session={session}/> : null}</div>
      <aside className="mission-panel"><p className="eyebrow">Route intelligence / 003</p><h1>Read the state.<br/><em>Then choose.</em></h1><p className="lede">Start a field session to attach weather, daylight, pace, and fatigue to the selected route.</p>
        <div className="trail-card" aria-live="polite">{status==="loading"&&<p className="system-message">Reading route catalog…</p>}{status==="error"&&<p className="system-message error">The latest request failed. Try again.</p>}{hike&&<><div className="trail-heading"><div><small>Selected hike</small><h2>{hike.name}</h2></div><span className="difficulty">{hike.difficulty}</span></div><p className="location">{hike.location}</p></>}</div>
        <div className="route-options" aria-label="Route alternatives">{routes.map((route,index)=>{const active=route.properties.id===selectedRouteId;return <button key={route.properties.id} type="button" className="route-option" data-active={active} aria-pressed={active} disabled={Boolean(session)} onClick={()=>setSelectedRouteId(route.properties.id)}><span className="route-index">0{index+1}</span><span className="route-copy"><strong>{route.properties.name}</strong><small>{route.properties.distanceMiles} mi · +{route.properties.elevationGainFeet.toLocaleString("en-US")} ft · {route.properties.estimatedMinutes} min</small></span><span className={`exposure exposure-${route.properties.exposure}`}>{route.properties.exposure}</span></button>;})}</div>
        <button className="primary-action" type="button" disabled={!selectedRouteId||status==="starting"||Boolean(session)} onClick={()=>void startSession()}>{status==="starting"?"Starting session…":session?"Session active":"Start field session"}<span>↗</span></button><p className="safety-note"><strong>Decision support, not a safety guarantee.</strong> Static prototype conditions are not current field observations.</p>
      </aside>
    </section>
  </main>;
}
