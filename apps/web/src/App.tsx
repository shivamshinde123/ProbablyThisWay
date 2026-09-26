import { useEffect, useState } from "react";
import { hikeDetailSchema, hikesResponseSchema, type HikeDetail } from "@probably-this-way/contracts";
import { TerrainMap } from "./components/TerrainMap";

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api/v1";

export function App() {
  const [hike, setHike] = useState<HikeDetail>();
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  useEffect(() => {
    const controller = new AbortController();
    async function loadHike() {
      try {
        const listResponse = await fetch(`${apiBaseUrl}/hikes`, { signal: controller.signal });
        if (!listResponse.ok) throw new Error(`Catalog returned ${listResponse.status}`);
        const list = hikesResponseSchema.parse(await listResponse.json());
        const selected = list.items[0];
        if (!selected) throw new Error("Hike catalog is empty");
        const detailResponse = await fetch(`${apiBaseUrl}/hikes/${selected.id}`, { signal: controller.signal });
        if (!detailResponse.ok) throw new Error(`Hike detail returned ${detailResponse.status}`);
        setHike(hikeDetailSchema.parse(await detailResponse.json()));
        setStatus("ready");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setStatus("error");
      }
    }
    void loadHike();
    return () => controller.abort();
  }, []);

  const trail = hike?.trails[0];
  return <main className="app-shell">
    <header className="masthead"><a className="wordmark" href="/" aria-label="ProbablyThisWay home"><span className="waymark">PTW</span><span>ProbablyThisWay</span></a><div className="session-state"><span /> Field system · standby</div></header>
    <section className="hero-grid">
      <div className="map-stage"><TerrainMap trail={trail} /></div>
      <aside className="mission-panel"><p className="eyebrow">Route intelligence / 001</p><h1>Choose the trail.<br /><em>Know the tradeoff.</em></h1><p className="lede">A field instrument for comparing real routes against daylight, conditions, and your hiking state.</p>
        <div className="trail-card" aria-live="polite">{status === "loading" && <p className="system-message">Reading trail catalog…</p>}{status === "error" && <p className="system-message error">API unavailable. Start the local API and retry.</p>}{hike && <><div className="trail-heading"><div><small>Selected hike</small><h2>{hike.name}</h2></div><span className="difficulty">{hike.difficulty}</span></div><p className="location">{hike.location}</p><dl className="metrics"><div><dt>Distance</dt><dd>{hike.distanceMiles} mi</dd></div><div><dt>Gain</dt><dd>+{new Intl.NumberFormat("en-US").format(hike.elevationGainFeet)} ft</dd></div><div><dt>Trail data</dt><dd>{trail?.properties.dataQuality ?? "Pending"}</dd></div></dl></>}</div>
        <button className="primary-action" type="button" disabled={!hike}>Start field session <span>↗</span></button><p className="safety-note"><strong>Decision support, not a safety guarantee.</strong> Preview geometry is not valid for navigation.</p>
      </aside>
    </section>
  </main>;
}
