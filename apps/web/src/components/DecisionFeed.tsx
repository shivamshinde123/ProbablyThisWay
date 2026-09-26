import type { DecisionEvent } from "@probably-this-way/contracts";

type DecisionFeedProps = {
  events: DecisionEvent[];
  status: "idle" | "syncing" | "live" | "degraded";
};

const timeFormatter = new Intl.DateTimeFormat(undefined, { hour: "2-digit", minute: "2-digit" });
const thresholdLabels: Record<string, string> = {
  temperatureF: "temperature",
  windMph: "wind",
  rainProbability: "rain chance",
  remainingMinutes: "daylight",
  paceMph: "pace",
  fatigue: "fatigue",
};

export function DecisionFeed({ events, status }: DecisionFeedProps) {
  return (
    <section className="decision-feed" aria-labelledby="decision-feed-title">
      <div className="decision-feed-heading">
        <div>
          <span>Session log</span>
          <h2 id="decision-feed-title">Decision signal</h2>
        </div>
        <small data-status={status}>{status === "degraded" ? "retrying" : status}</small>
      </div>
      {events.length === 0 ? (
        <p className="decision-feed-empty">Waiting for the first decision record.</p>
      ) : (
        <ol aria-live="polite">
          {[...events.slice(-4)].reverse().map((event) => {
            const routeName = event.decision.recommendation.status === "recommended"
              ? event.decision.recommendation.routeId.replaceAll("-", " ")
              : "no eligible route";
            const trigger = event.crossedThresholds.map((field) => thresholdLabels[field] ?? field).join(", ");
            return (
              <li key={event.id}>
                <span className="event-sequence">{String(event.sequence).padStart(2, "0")}</span>
                <div>
                  <strong>{event.type === "session_started" ? "Initial route signal" : "Recommendation refreshed"}</strong>
                  <p>
                    <span>{routeName}</span>
                    {trigger ? " · " + trigger : " · shared starting state"}
                  </p>
                </div>
                <time dateTime={event.occurredAt}>{timeFormatter.format(new Date(event.occurredAt))}</time>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
