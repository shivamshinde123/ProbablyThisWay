import {
  internetTrailResultSchema,
  internetTrailSearchResponseSchema,
  type InternetTrailSearchResponse,
} from "@probably-this-way/contracts";
import { z } from "zod";

const coordinateSchema = z.tuple([z.number(), z.number()]);
const lineSchema = z.array(coordinateSchema).min(2);
const linearGeometrySchema = z.union([
  z.object({ type: z.literal("LineString"), coordinates: lineSchema }),
  z.object({
    type: z.literal("MultiLineString"),
    coordinates: z.array(lineSchema).min(1),
  }),
]);
const rawFeatureSchema = z.object({
  properties: z.object({
    osm_type: z.enum(["node", "way", "relation"]),
    osm_id: z.number().int().positive(),
    category: z.string(),
    type: z.string(),
    name: z.string().optional(),
    display_name: z.string().min(1),
  }),
  geometry: z.object({ type: z.string() }).passthrough(),
});
const rawResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(rawFeatureSchema),
});

const trailTypes = new Set([
  "bridleway",
  "foot",
  "footway",
  "hiking",
  "path",
  "pedestrian",
  "steps",
  "track",
  "walking",
]);

export interface TrailSearchProvider {
  search(query: string): Promise<InternetTrailSearchResponse>;
}

type Fetch = typeof fetch;

type CacheEntry = {
  expiresAt: number;
  response: InternetTrailSearchResponse;
};

export class NominatimTrailSearchProvider implements TrailSearchProvider {
  readonly #baseUrl: string;
  readonly #fetch: Fetch;
  readonly #minimumIntervalMs: number;
  readonly #cacheTtlMs: number;
  readonly #cache = new Map<string, CacheEntry>();
  #nextRequestAt = 0;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    options: {
      baseUrl?: string;
      fetchImpl?: Fetch;
      minimumIntervalMs?: number;
      cacheTtlMs?: number;
    } = {},
  ) {
    this.#baseUrl =
      options.baseUrl ?? "https://nominatim.openstreetmap.org/search";
    this.#fetch = options.fetchImpl ?? fetch;
    this.#minimumIntervalMs = options.minimumIntervalMs ?? 1_100;
    this.#cacheTtlMs = options.cacheTtlMs ?? 15 * 60_000;
  }

  async search(query: string): Promise<InternetTrailSearchResponse> {
    const normalized = query.trim().replace(/s+/g, " ");
    const cacheKey = normalized.toLocaleLowerCase();
    const cached = this.#cache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) return cached.response;

    let release: (() => void) | undefined;
    const predecessor = this.#queue;
    this.#queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await predecessor;

    try {
      const secondCached = this.#cache.get(cacheKey);
      if (secondCached && secondCached.expiresAt > Date.now())
        return secondCached.response;

      const waitMs = Math.max(0, this.#nextRequestAt - Date.now());
      if (waitMs > 0)
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.#nextRequestAt = Date.now() + this.#minimumIntervalMs;

      const url = new URL(this.#baseUrl);
      url.searchParams.set("q", normalized);
      url.searchParams.set("format", "geojson");
      url.searchParams.set("polygon_geojson", "1");
      url.searchParams.set("polygon_threshold", "0.0001");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("limit", "8");

      const response = await this.#fetch(url, {
        headers: {
          accept: "application/geo+json, application/json",
          "user-agent":
            "ProbablyThisWay/0.1 (+https://github.com/shivamshinde123/ProbablyThisWay)",
        },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok)
        throw new Error("Nominatim returned " + response.status);

      const payload = rawResponseSchema.parse(await response.json());
      const items = payload.features
        .filter(
          (feature) =>
            (feature.geometry.type === "LineString" ||
              feature.geometry.type === "MultiLineString") &&
            (trailTypes.has(feature.properties.type) ||
              /(trail|path|walk|hike|way)/i.test(
                feature.properties.name ??
                  feature.properties.display_name.split(",")[0] ??
                  "",
              )),
        )
        .flatMap((feature) => {
          const parsedGeometry = linearGeometrySchema.safeParse(
            feature.geometry,
          );
          if (!parsedGeometry.success) return [];
          const name =
            feature.properties.name ??
            feature.properties.display_name.split(",")[0] ??
            normalized;
          const location =
            feature.properties.display_name
              .split(",")
              .slice(1)
              .join(",")
              .trim() || "Location not supplied by OpenStreetMap";
          const geometry = parsedGeometry.data;
          return [
            internetTrailResultSchema.parse({
              id:
                "osm-" +
                feature.properties.osm_type +
                "-" +
                feature.properties.osm_id,
              name,
              location,
              distanceMiles: distanceMiles(geometry),
              geometry,
              source: "OpenStreetMap via Nominatim",
              sourceUrl:
                "https://www.openstreetmap.org/" +
                feature.properties.osm_type +
                "/" +
                feature.properties.osm_id,
            }),
          ];
        });

      const result = internetTrailSearchResponseSchema.parse({
        query: normalized,
        attribution: "© OpenStreetMap contributors",
        attributionUrl: "https://www.openstreetmap.org/copyright",
        items,
      });
      this.#cache.set(cacheKey, {
        expiresAt: Date.now() + this.#cacheTtlMs,
        response: result,
      });
      if (this.#cache.size > 100)
        this.#cache.delete(this.#cache.keys().next().value!);
      return result;
    } finally {
      release?.();
    }
  }
}

function distanceMiles(
  geometry:
    | { type: "LineString"; coordinates: [number, number][] }
    | { type: "MultiLineString"; coordinates: [number, number][][] },
): number {
  const lines =
    geometry.type === "LineString"
      ? [geometry.coordinates]
      : geometry.coordinates;
  let miles = 0;
  for (const line of lines) {
    for (let index = 1; index < line.length; index += 1) {
      const start = line[index - 1]!;
      const end = line[index]!;
      miles += haversineMiles(start, end);
    }
  }
  return Math.max(0.01, Math.round(miles * 100) / 100);
}

function haversineMiles(
  [startLongitude, startLatitude]: [number, number],
  [endLongitude, endLatitude]: [number, number],
): number {
  const radians = Math.PI / 180;
  const latitudeDelta = (endLatitude - startLatitude) * radians;
  const longitudeDelta = (endLongitude - startLongitude) * radians;
  const start = startLatitude * radians;
  const end = endLatitude * radians;
  const a =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(start) * Math.cos(end) * Math.sin(longitudeDelta / 2) ** 2;
  return 3_958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
