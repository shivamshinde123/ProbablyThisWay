import {
  hikingStateSchema,
  type HikingState,
} from "@probably-this-way/contracts";
import type { SessionRecord, SessionStore } from "./session-store.js";
import type {
  EnvironmentalSnapshot,
  WeatherLocation,
  WeatherProvider,
} from "./weather-adapter.js";

export const DEFAULT_WEATHER_REFRESH_INTERVAL_MS = 5 * 60_000;
const MINIMUM_WEATHER_REFRESH_INTERVAL_MS = 60_000;

export function resolveWeatherRefreshInterval(
  env: NodeJS.ProcessEnv = process.env,
): number {
  const configured = env.WEATHER_REFRESH_INTERVAL_MS?.trim();
  if (!configured) return DEFAULT_WEATHER_REFRESH_INTERVAL_MS;
  const interval = Number(configured);
  if (
    !Number.isSafeInteger(interval) ||
    interval < MINIMUM_WEATHER_REFRESH_INTERVAL_MS
  ) {
    throw new Error(
      `WEATHER_REFRESH_INTERVAL_MS must be an integer of at least ${MINIMUM_WEATHER_REFRESH_INTERVAL_MS}`,
    );
  }
  return interval;
}

export type WeatherRefreshResult = "accepted" | "stale" | "conflict";

type WeatherRefresherOptions = {
  sessionStore: SessionStore;
  weatherProvider: WeatherProvider;
  locations: Readonly<Record<string, WeatherLocation>>;
  intervalMs: number;
  applySnapshot: (
    record: SessionRecord,
    state: HikingState,
  ) => Promise<WeatherRefreshResult>;
  onSessionError?: (record: SessionRecord, error: unknown) => Promise<void>;
  onError?: (
    error: unknown,
    context: { hikeId?: string; sessionId?: string },
  ) => void;
};

export class WeatherRefresher {
  readonly #options: WeatherRefresherOptions;
  #timer: NodeJS.Timeout | undefined;
  #running = false;

  constructor(options: WeatherRefresherOptions) {
    this.#options = options;
  }

  start(): void {
    if (this.#timer) return;
    this.#timer = setInterval(
      () => void this.refreshNow(),
      this.#options.intervalMs,
    );
    this.#timer.unref();
  }

  stop(): void {
    if (!this.#timer) return;
    clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async refreshNow(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      const sessionIds =
        await this.#options.sessionStore.listActiveSessionIds();
      const snapshots = new Map<string, Promise<EnvironmentalSnapshot>>();

      for (const sessionId of sessionIds) {
        let record: SessionRecord | undefined;
        try {
          record = await this.#options.sessionStore.get(sessionId);
          if (!record) continue;
          const location = this.#options.locations[record.session.hikeId];
          if (!location)
            throw new Error(
              `Hike ${record.session.hikeId} has no weather location`,
            );
          let snapshot = snapshots.get(record.session.hikeId);
          if (!snapshot) {
            snapshot = this.#options.weatherProvider.getCurrent(location);
            snapshots.set(record.session.hikeId, snapshot);
          }
          const environmental = await snapshot;
          const nextState = hikingStateSchema.parse({
            ...environmental,
            user: record.session.state.user,
          });
          await this.#options.applySnapshot(record, nextState);
        } catch (error) {
          const context = { sessionId, hikeId: record?.session.hikeId };
          if (record && this.#options.onSessionError) {
            try {
              await this.#options.onSessionError(record, error);
            } catch (statusError) {
              this.#options.onError?.(statusError, context);
            }
          }
          this.#options.onError?.(error, context);
        }
      }
    } catch (error) {
      this.#options.onError?.(error, {});
    } finally {
      this.#running = false;
    }
  }
}
