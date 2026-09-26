import { z } from "zod";

const openMeteoResponseSchema = z.object({
  current: z.object({
    time: z.string().min(1),
    temperature_2m: z.number(),
    wind_speed_10m: z.number().nonnegative(),
    precipitation_probability: z.number().min(0).max(100),
    is_day: z.union([z.literal(0), z.literal(1)]),
  }),
  daily: z.object({
    time: z.array(z.string().min(1)).min(1),
    sunset: z.array(z.string().min(1)).min(1),
  }),
});

export type WeatherLocation = {
  latitude: number;
  longitude: number;
};

export type EnvironmentalSnapshot = {
  observedAt: string;
  source: "weather";
  provenance: {
    provider: string;
    license: string;
    attributionUrl: string;
  };
  weather: {
    temperatureF: number;
    windMph: number;
    rainProbability: number;
  };
  daylight: {
    sunsetAt: string;
    remainingMinutes: number;
  };
};

export interface WeatherProvider {
  getCurrent(location: WeatherLocation): Promise<EnvironmentalSnapshot>;
}

type WeatherAdapterOptions = {
  baseUrl: string;
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

function utcTimestamp(value: string): string {
  const explicitZone = /(?:Z|[+-]\d{2}:\d{2})$/u.test(value) ? value : `${value}Z`;
  const parsed = new Date(explicitZone);
  if (Number.isNaN(parsed.getTime())) throw new Error("Weather provider returned an invalid timestamp");
  return parsed.toISOString();
}

export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly #baseUrl: string;
  readonly #apiKey: string | undefined;
  readonly #fetch: typeof fetch;
  readonly #timeoutMs: number;

  constructor({ baseUrl, apiKey, fetchImpl = fetch, timeoutMs = 4_000 }: WeatherAdapterOptions) {
    const parsed = new URL(baseUrl);
    if (parsed.protocol !== "https:" && parsed.hostname !== "localhost" && parsed.hostname !== "127.0.0.1") {
      throw new Error("WEATHER_API_BASE_URL must use HTTPS outside local development");
    }
    if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) throw new Error("Weather timeout must be a positive integer");
    this.#baseUrl = parsed.toString();
    this.#apiKey = apiKey?.trim() || undefined;
    this.#fetch = fetchImpl;
    this.#timeoutMs = timeoutMs;
  }

  async getCurrent(location: WeatherLocation): Promise<EnvironmentalSnapshot> {
    const url = new URL(this.#baseUrl);
    url.searchParams.set("latitude", String(location.latitude));
    url.searchParams.set("longitude", String(location.longitude));
    url.searchParams.set("current", "temperature_2m,wind_speed_10m,precipitation_probability,is_day");
    url.searchParams.set("daily", "sunset");
    url.searchParams.set("temperature_unit", "fahrenheit");
    url.searchParams.set("wind_speed_unit", "mph");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("forecast_days", "1");
    if (this.#apiKey) url.searchParams.set("apikey", this.#apiKey);

    const response = await this.#fetch(url, { signal: AbortSignal.timeout(this.#timeoutMs) });
    if (!response.ok) throw new Error(`Weather provider returned ${response.status}`);
    const parsed = openMeteoResponseSchema.parse(await response.json());
    const observedAt = utcTimestamp(parsed.current.time);
    const sunsetAt = utcTimestamp(parsed.daily.sunset[0] ?? "");
    const remainingMinutes = parsed.current.is_day === 1
      ? Math.max(0, Math.floor((Date.parse(sunsetAt) - Date.parse(observedAt)) / 60_000))
      : 0;

    return {
      observedAt,
      source: "weather",
      provenance: {
        provider: "Open-Meteo",
        license: "CC BY 4.0",
        attributionUrl: "https://open-meteo.com/",
      },
      weather: {
        temperatureF: parsed.current.temperature_2m,
        windMph: parsed.current.wind_speed_10m,
        rainProbability: parsed.current.precipitation_probability / 100,
      },
      daylight: { sunsetAt, remainingMinutes },
    };
  }
}

export function createWeatherProvider(env: NodeJS.ProcessEnv = process.env): WeatherProvider | undefined {
  const baseUrl = env.WEATHER_API_BASE_URL?.trim();
  if (baseUrl) return new OpenMeteoWeatherProvider({ baseUrl, apiKey: env.WEATHER_API_KEY });
  if (env.NODE_ENV === "production") {
    throw new Error("WEATHER_API_BASE_URL is required when NODE_ENV=production");
  }
  return undefined;
}
