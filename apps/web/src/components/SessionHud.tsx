import type { Session } from "@probably-this-way/contracts";

type SessionHudProps = { session: Session };

const sourceLabels: Record<Session["state"]["source"], string> = {
  "prototype-static": "Prototype-static baseline",
  weather: "Weather update",
  "user-input": "User-entered update",
  "system-time": "System-time update",
};

function freshnessFor(session: Session): {
  status: "current" | "stale" | "prototype";
  label: string;
} {
  const configured = session.environmentalStatus;
  if (!configured || configured.status === "prototype") {
    return session.state.source === "prototype-static"
      ? { status: "prototype", label: "Prototype data" }
      : { status: "stale", label: "Freshness unknown" };
  }
  const expired =
    configured.status === "current" &&
    configured.staleAfter !== undefined &&
    Date.parse(configured.staleAfter) <= Date.now();
  if (configured.status === "current" && !expired) {
    return { status: "current", label: "Conditions current" };
  }
  return {
    status: "stale",
    label:
      configured.reason === "refresh_failed"
        ? "Refresh failed"
        : "Conditions stale",
  };
}

export function SessionHud({ session }: SessionHudProps) {
  const state = session.state;
  const freshness = freshnessFor(session);
  return (
    <section className="session-hud" aria-label="Current hiking state">
      <div className="hud-heading">
        <span>Live session</span>
        <small
          className="freshness-status"
          data-status={freshness.status}
          role="status"
        >
          <i />
          {freshness.label}
        </small>
        <strong>{session.id.slice(0, 8)}</strong>
      </div>
      <dl>
        <div>
          <dt>Temp</dt>
          <dd>{state.weather.temperatureF}°F</dd>
        </div>
        <div>
          <dt>Wind</dt>
          <dd>{state.weather.windMph} mph</dd>
        </div>
        <div>
          <dt>Rain</dt>
          <dd>{Math.round(state.weather.rainProbability * 100)}%</dd>
        </div>
        <div>
          <dt>Daylight</dt>
          <dd>
            {Math.floor(state.daylight.remainingMinutes / 60)}h{" "}
            {state.daylight.remainingMinutes % 60}m
          </dd>
        </div>
        <div>
          <dt>Pace</dt>
          <dd>{state.user.paceMph} mph</dd>
        </div>
        <div>
          <dt>Fatigue</dt>
          <dd>{state.user.fatigue}</dd>
        </div>
      </dl>
      <p>
        {sourceLabels[state.source]} · observed{" "}
        {new Date(state.observedAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        })}
        {freshness.status === "stale"
          ? " · showing last valid observation"
          : null}
        {state.provenance ? (
          <>
            {" "}
            · Data:{" "}
            <a
              href={state.provenance.attributionUrl}
              target="_blank"
              rel="noreferrer"
            >
              {state.provenance.provider}
            </a>{" "}
            ({state.provenance.license})
          </>
        ) : null}
      </p>
    </section>
  );
}
