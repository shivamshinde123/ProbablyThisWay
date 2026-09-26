import type { HikingState } from "@probably-this-way/contracts";

export const REEVALUATION_THRESHOLDS = {
  temperatureF: 10,
  windMph: 5,
  rainProbability: 0.15,
  remainingMinutes: 10,
  paceRatio: 0.15,
} as const;

export function detectRelevantThresholds(previous: HikingState, current: HikingState): string[] {
  const crossed: string[] = [];

  if (Math.abs(current.weather.temperatureF - previous.weather.temperatureF) >= REEVALUATION_THRESHOLDS.temperatureF) crossed.push("temperatureF");
  if (Math.abs(current.weather.windMph - previous.weather.windMph) >= REEVALUATION_THRESHOLDS.windMph) crossed.push("windMph");
  if (Math.abs(current.weather.rainProbability - previous.weather.rainProbability) >= REEVALUATION_THRESHOLDS.rainProbability) crossed.push("rainProbability");
  if (Math.abs(current.daylight.remainingMinutes - previous.daylight.remainingMinutes) >= REEVALUATION_THRESHOLDS.remainingMinutes) crossed.push("remainingMinutes");
  if (Math.abs(current.user.paceMph - previous.user.paceMph) / previous.user.paceMph >= REEVALUATION_THRESHOLDS.paceRatio) crossed.push("paceMph");
  if (current.user.fatigue !== previous.user.fatigue) crossed.push("fatigue");

  return crossed;
}
