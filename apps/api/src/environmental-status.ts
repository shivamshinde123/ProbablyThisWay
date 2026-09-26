import {
  environmentalStatusSchema,
  type EnvironmentalStatus,
  type HikingState,
} from "@probably-this-way/contracts";

export const DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS = 30 * 60_000;
const MINIMUM_WEATHER_FRESHNESS_MAX_AGE_MS = 15 * 60_000;

export function resolveWeatherFreshnessMaxAge(
  env: NodeJS.ProcessEnv = process.env,
  refreshIntervalMs = 0,
): number {
  const configured = env.WEATHER_FRESHNESS_MAX_AGE_MS?.trim();
  const maxAge = configured
    ? Number(configured)
    : DEFAULT_WEATHER_FRESHNESS_MAX_AGE_MS;
  if (
    !Number.isSafeInteger(maxAge) ||
    maxAge < MINIMUM_WEATHER_FRESHNESS_MAX_AGE_MS
  ) {
    throw new Error(
      `WEATHER_FRESHNESS_MAX_AGE_MS must be an integer of at least ${MINIMUM_WEATHER_FRESHNESS_MAX_AGE_MS}`,
    );
  }
  if (maxAge < refreshIntervalMs) {
    throw new Error(
      "WEATHER_FRESHNESS_MAX_AGE_MS must be greater than or equal to WEATHER_REFRESH_INTERVAL_MS",
    );
  }
  return maxAge;
}

export function currentEnvironmentalStatus(
  state: HikingState,
  maxAgeMs: number,
): EnvironmentalStatus {
  const observedAt = Date.parse(state.observedAt);
  if (!Number.isFinite(observedAt))
    throw new Error(
      "Cannot calculate freshness from an invalid observation time",
    );
  return environmentalStatusSchema.parse({
    status: "current",
    reason: "observation_current",
    checkedAt: state.receivedAt ?? new Date().toISOString(),
    staleAfter: new Date(observedAt + maxAgeMs).toISOString(),
  });
}

export function prototypeEnvironmentalStatus(
  checkedAt: string,
): EnvironmentalStatus {
  return environmentalStatusSchema.parse({
    status: "prototype",
    reason: "prototype_static",
    checkedAt,
  });
}

export function failedEnvironmentalStatus(
  previous: EnvironmentalStatus | undefined,
  checkedAt: string,
): EnvironmentalStatus {
  return environmentalStatusSchema.parse({
    status: "stale",
    reason: "refresh_failed",
    checkedAt,
    staleAfter: previous?.staleAfter,
  });
}

export function resolveEnvironmentalStatus(
  status: EnvironmentalStatus | undefined,
  state: HikingState,
  maxAgeMs: number,
  now = new Date(),
): EnvironmentalStatus {
  if (state.source === "prototype-static") {
    return (
      status ??
      prototypeEnvironmentalStatus(state.receivedAt ?? state.observedAt)
    );
  }
  const resolved = status ?? currentEnvironmentalStatus(state, maxAgeMs);
  if (
    resolved.status === "current" &&
    resolved.staleAfter &&
    Date.parse(resolved.staleAfter) <= now.getTime()
  ) {
    return environmentalStatusSchema.parse({
      ...resolved,
      status: "stale",
      reason: "observation_expired",
    });
  }
  return resolved;
}
