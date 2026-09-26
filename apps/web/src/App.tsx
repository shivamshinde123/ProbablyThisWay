import { useEffect, useState } from "react";
import { hikesResponseSchema, type HikeSummary } from "@probably-this-way/contracts";
import { TerrainMap } from "./components/TerrainMap";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

export function App() {
  const [hikes, setHikes] = useState<HikeSummary[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    fetch(`${apiBaseUrl}/hikes`, { signal: controller.signal })
      .then((response) => { if (!response.ok) throw new Error(`API returned ${response.status}`); return response.json(); })
      .then((payload) => { setHikes(hikesResponseSchema.parse(payload).items); setStatus("ready"); })
      .catch((error: unknown) => { if (error instanceof DOMException && error.name === "AbortError") return; setStatus("error"); });
    return () => controller.abort();
  }, []);

  const hike = hikes[0];
  return <main className="app-shell">
    <header className="masthead"><a className="wordmark" href="/" aria-label="ProbablyThisWay home"><span className="waymark">PTW</span><span>ProbablyThisWay</span></a><div className="session-state"><span /> Field system · standby</div></header>
    <section className="hero-grid">
      <div className="map-stage"><TerrainMap /></div>
      <aside className="mission-panel"><p className="eyebrow">Route intelligence / 001</p><h1>Choose the trail.<br /><em>Know the tradeoff.</em></h1><p className="lede">A field instrument for comparing real routes against daylight, conditions, and your hiking state.</p>
        <div className="trail-card" aria-live="polite">{status === "loading" && <p className="system-message">Reading trail catalog…</p>}{status === "error" && <p className="system-message error">API unavailable. Start the local API and retry.</p>}{hike && <><div className="trail-heading"><div><small>Selected hike</small><h2>{hike.name}</h2></div><span className="difficulty">{hike.difficulty}</span></div><p className="location">{hike.location}</p><dl className="metrics"><div><dt>Distance</dt><dd>{hike.distanceMiles} mi</dd></div><div><dt>Gain</dt><dd>+{new Intl.NumberFormat("en-US").format(hike.elevationGainFeet)} ft</dd></div><div><dt>Routes</dt><dd>Pending</dd></div></dl></>}</div>
        <button className="primary-action" type="button" disabled={!hike}>Start field session <span>↗</span></button><p className="safety-note"><strong>Decision support, not a safety guarantee.</strong> Check official trail guidance before departure.</p>
      </aside>
    </section>
  </main>;
}
