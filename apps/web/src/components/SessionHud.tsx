import type { Session } from "@probably-this-way/contracts";

type SessionHudProps = { session: Session };

const sourceLabels: Record<Session["state"]["source"], string> = {
  "prototype-static": "Prototype-static baseline",
  weather: "Weather update",
  "user-input": "User-entered update",
  "system-time": "System-time update",
};

export function SessionHud({ session }: SessionHudProps) {
  const state = session.state;
  return <section className="session-hud" aria-label="Current hiking state">
    <div className="hud-heading"><span>Live session</span><strong>{session.id.slice(0, 8)}</strong></div>
    <dl>
      <div><dt>Temp</dt><dd>{state.weather.temperatureF}°F</dd></div>
      <div><dt>Wind</dt><dd>{state.weather.windMph} mph</dd></div>
      <div><dt>Rain</dt><dd>{Math.round(state.weather.rainProbability * 100)}%</dd></div>
      <div><dt>Daylight</dt><dd>{Math.floor(state.daylight.remainingMinutes / 60)}h {state.daylight.remainingMinutes % 60}m</dd></div>
      <div><dt>Pace</dt><dd>{state.user.paceMph} mph</dd></div>
      <div><dt>Fatigue</dt><dd>{state.user.fatigue}</dd></div>
    </dl>
    <p>
      {sourceLabels[state.source]} · observed {new Date(state.observedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
      {state.provenance ? <> · Data: <a href={state.provenance.attributionUrl} target="_blank" rel="noreferrer">{state.provenance.provider}</a> ({state.provenance.license})</> : null}
    </p>
  </section>;
}
