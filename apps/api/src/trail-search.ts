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
  geometry: z
    .object({ type: z.string(), coordinates: z.unknown().optional() })
    .passthrough(),
});
const rawResponseSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(rawFeatureSchema),
});
const osmNodeSchema = z.object({
  type: z.literal("node"),
  id: z.number().int().positive(),
  lat: z.number(),
  lon: z.number(),
});
const osmWaySchema = z.object({
  type: z.literal("way"),
  id: z.number().int().positive(),
  nodes: z.array(z.number().int().positive()).min(2),
  tags: z.record(z.string(), z.string()).optional(),
});
const osmMapSchema = z.object({ elements: z.array(z.unknown()) });

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
const hardSurfaceTypes = new Set([
  "asphalt",
  "concrete",
  "concrete:plates",
  "paved",
  "paving_stones",
]);
const softSurfaceTypes = new Set([
  "compacted",
  "dirt",
  "earth",
  "fine_gravel",
  "gravel",
  "ground",
  "mud",
  "rock",
  "sand",
  "unpaved",
]);

export interface TrailSearchProvider {
  search(query: string): Promise<InternetTrailSearchResponse>;
}

type Fetch = typeof fetch;

type CacheEntry = {
  expiresAt: number;
  response: InternetTrailSearchResponse;
};

type NearbyCandidate = {
  id: number;
  name?: string;
  geometry: { type: "LineString"; coordinates: [number, number][] };
  distanceFromCenter: number;
  score: number;
};

export class NominatimTrailSearchProvider implements TrailSearchProvider {
  readonly #baseUrl: string;
  readonly #mapApiBaseUrl: string;
  readonly #fetch: Fetch;
  readonly #minimumIntervalMs: number;
  readonly #cacheTtlMs: number;
  readonly #cache = new Map<string, CacheEntry>();
  #nextRequestAt = 0;
  #queue: Promise<void> = Promise.resolve();

  constructor(
    options: {
      baseUrl?: string;
      mapApiBaseUrl?: string;
      fetchImpl?: Fetch;
      minimumIntervalMs?: number;
      cacheTtlMs?: number;
    } = {},
  ) {
    this.#baseUrl =
      options.baseUrl ?? "https://nominatim.openstreetmap.org/search";
    this.#mapApiBaseUrl =
      options.mapApiBaseUrl ?? "https://api.openstreetmap.org/api/0.6/map";
    this.#fetch = options.fetchImpl ?? fetch;
    this.#minimumIntervalMs = options.minimumIntervalMs ?? 1_100;
    this.#cacheTtlMs = options.cacheTtlMs ?? 15 * 60_000;
  }

  async search(query: string): Promise<InternetTrailSearchResponse> {
    const normalized = query.trim().replace(/\s+/g, " ");
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

      const response = await this.#fetch(url, requestInit());
      if (!response.ok)
        throw new Error("Nominatim returned " + response.status);

      const payload = rawResponseSchema.parse(await response.json());
      let items = directTrailItems(payload.features, normalized);
      if (items.length === 0) {
        const anchor = payload.features.find(
          (feature) => centerOfGeometry(feature.geometry) !== undefined,
        );
        const center = anchor ? centerOfGeometry(anchor.geometry) : undefined;
        if (anchor && center) {
          items = await this.#nearbyTrailItems(anchor, center, normalized);
        }
      }

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

  async #nearbyTrailItems(
    anchor: z.infer<typeof rawFeatureSchema>,
    center: [number, number],
    query: string,
  ): Promise<InternetTrailSearchResponse["items"]> {
    const [longitude, latitude] = center;
    let payload: z.infer<typeof osmMapSchema> | undefined;
    for (const latitudeRadius of [0.006, 0.003]) {
      const longitudeRadius =
        latitudeRadius / Math.max(0.3, Math.cos((latitude * Math.PI) / 180));
      const url = new URL(this.#mapApiBaseUrl);
      url.searchParams.set(
        "bbox",
        [
          longitude - longitudeRadius,
          latitude - latitudeRadius,
          longitude + longitudeRadius,
          latitude + latitudeRadius,
        ].join(","),
      );

      const response = await this.#fetch(url, requestInit());
      if (response.ok) {
        payload = osmMapSchema.parse(await response.json());
        break;
      }
      if (response.status !== 400)
        throw new Error("OpenStreetMap map API returned " + response.status);
    }
    if (!payload) return [];
    const nodes = new Map<number, [number, number]>();
    const ways: z.infer<typeof osmWaySchema>[] = [];
    for (const element of payload.elements) {
      const node = osmNodeSchema.safeParse(element);
      if (node.success) {
        nodes.set(node.data.id, [node.data.lon, node.data.lat]);
        continue;
      }
      const way = osmWaySchema.safeParse(element);
      if (way.success) ways.push(way.data);
    }

    const candidates = ways.flatMap((way): NearbyCandidate[] => {
      const tags = way.tags ?? {};
      if (!trailTypes.has(tags.highway ?? "")) return [];
      if (
        ["no", "private"].includes(tags.access ?? "") ||
        ["no", "private"].includes(tags.foot ?? "") ||
        ["sidewalk", "crossing", "traffic_island"].includes(tags.footway ?? "")
      )
        return [];
      const coordinates = way.nodes.flatMap((nodeId) => {
        const coordinate = nodes.get(nodeId);
        return coordinate ? [coordinate] : [];
      });
      if (coordinates.length < 2) return [];
      const geometry = { type: "LineString" as const, coordinates };
      const trailLength = distanceMiles(geometry);
      if (trailLength < 0.02) return [];
      const distanceFromCenter = Math.min(
        ...coordinates.map((coordinate) => haversineMiles(center, coordinate)),
      );
      let score =
        tags.highway === "path"
          ? 32
          : tags.highway === "bridleway"
            ? 27
            : tags.highway === "track"
              ? 22
              : tags.highway === "footway"
                ? 8
                : 2;
      if (tags.name || tags.ref) score += 28;
      if (tags.sac_scale || tags.trail_visibility) score += 18;
      if (softSurfaceTypes.has(tags.surface ?? "")) score += 10;
      if (hardSurfaceTypes.has(tags.surface ?? "")) score -= 18;
      score -= distanceFromCenter * 22;
      score += Math.min(8, trailLength * 8);
      return [
        {
          id: way.id,
          name: tags.name ?? tags.ref,
          geometry,
          distanceFromCenter,
          score,
        },
      ];
    });

    const placeName =
      anchor.properties.name ??
      anchor.properties.display_name.split(",")[0] ??
      query;
    const location =
      anchor.properties.display_name.split(",").slice(1).join(",").trim() ||
      "Near " + placeName;

    const ranked = candidates.sort(
      (left, right) =>
        right.score - left.score ||
        left.distanceFromCenter - right.distanceFromCenter,
    );
    if (ranked.length === 0) return [];

    const nearby = [...ranked]
      .sort(
        (left, right) =>
          left.distanceFromCenter - right.distanceFromCenter ||
          right.score - left.score,
      )
      .slice(0, 20);
    const nearbyGeometry =
      nearby.length === 1
        ? nearby[0]!.geometry
        : {
            type: "MultiLineString" as const,
            coordinates: nearby.map(
              (candidate) => candidate.geometry.coordinates,
            ),
          };
    const network = internetTrailResultSchema.parse({
      id:
        "osm-nearby-" +
        anchor.properties.osm_type +
        "-" +
        anchor.properties.osm_id,
      name: "Trails at " + placeName,
      location,
      distanceMiles: distanceMiles(nearbyGeometry),
      geometry: nearbyGeometry,
      source: "OpenStreetMap via Nominatim",
      sourceUrl:
        "https://www.openstreetmap.org/" +
        anchor.properties.osm_type +
        "/" +
        anchor.properties.osm_id,
    });
    const namedTrails = ranked
      .filter((candidate) => candidate.name)
      .slice(0, 7)
      .map((candidate) =>
        internetTrailResultSchema.parse({
          id: "osm-way-" + candidate.id,
          name: candidate.name!,
          location,
          distanceMiles: distanceMiles(candidate.geometry),
          geometry: candidate.geometry,
          source: "OpenStreetMap via Nominatim",
          sourceUrl: "https://www.openstreetmap.org/way/" + candidate.id,
        }),
      );
    return [network, ...namedTrails];
  }
}

function requestInit(): RequestInit {
  return {
    headers: {
      accept: "application/geo+json, application/json",
      "user-agent":
        "ProbablyThisWay/0.1 (+https://github.com/shivamshinde123/ProbablyThisWay)",
    },
    signal: AbortSignal.timeout(10_000),
  };
}

function directTrailItems(
  features: z.infer<typeof rawFeatureSchema>[],
  normalized: string,
): InternetTrailSearchResponse["items"] {
  return features
    .filter(
      (feature) =>
        (feature.geometry.type === "LineString" ||
          feature.geometry.type === "MultiLineString") &&
        (trailTypes.has(feature.properties.type) ||
          /\b(trail|path|walk|hike|way)\b/i.test(
            feature.properties.name ??
              feature.properties.display_name.split(",")[0] ??
              "",
          )),
    )
    .flatMap((feature) => {
      const parsedGeometry = linearGeometrySchema.safeParse(feature.geometry);
      if (!parsedGeometry.success) return [];
      const name =
        feature.properties.name ??
        feature.properties.display_name.split(",")[0] ??
        normalized;
      const location =
        feature.properties.display_name.split(",").slice(1).join(",").trim() ||
        "Location not supplied by OpenStreetMap";
      return [
        internetTrailResultSchema.parse({
          id:
            "osm-" +
            feature.properties.osm_type +
            "-" +
            feature.properties.osm_id,
          name,
          location,
          distanceMiles: distanceMiles(parsedGeometry.data),
          geometry: parsedGeometry.data,
          source: "OpenStreetMap via Nominatim",
          sourceUrl:
            "https://www.openstreetmap.org/" +
            feature.properties.osm_type +
            "/" +
            feature.properties.osm_id,
        }),
      ];
    });
}

function centerOfGeometry(
  geometry: z.infer<typeof rawFeatureSchema>["geometry"],
): [number, number] | undefined {
  if (
    geometry.type === "Point" &&
    Array.isArray(geometry.coordinates) &&
    geometry.coordinates.length >= 2 &&
    typeof geometry.coordinates[0] === "number" &&
    typeof geometry.coordinates[1] === "number"
  ) {
    return [geometry.coordinates[0], geometry.coordinates[1]];
  }
  const pairs = collectCoordinatePairs(geometry.coordinates);
  if (pairs.length === 0) return undefined;
  return [
    pairs.reduce((sum, coordinate) => sum + coordinate[0], 0) / pairs.length,
    pairs.reduce((sum, coordinate) => sum + coordinate[1], 0) / pairs.length,
  ];
}

function collectCoordinatePairs(value: unknown): [number, number][] {
  if (!Array.isArray(value)) return [];
  if (
    value.length >= 2 &&
    typeof value[0] === "number" &&
    typeof value[1] === "number"
  )
    return [[value[0], value[1]]];
  return value.flatMap(collectCoordinatePairs);
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
