import {
  hikeDetailSchema,
  type HikeDetail,
  type InternetTrailResult,
} from "@probably-this-way/contracts";

const EARTH_RADIUS_MILES = 3_958.8;

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function lineDistanceMiles(coordinates: [number, number][]): number {
  let distance = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const previous = coordinates[index - 1];
    const current = coordinates[index];
    if (!previous || !current) continue;
    const latitudeDelta = toRadians(current[1] - previous[1]);
    const longitudeDelta = toRadians(current[0] - previous[0]);
    const latitude1 = toRadians(previous[1]);
    const latitude2 = toRadians(current[1]);
    const haversine =
      Math.sin(latitudeDelta / 2) ** 2 +
      Math.cos(latitude1) *
        Math.cos(latitude2) *
        Math.sin(longitudeDelta / 2) ** 2;
    distance +=
      2 * EARTH_RADIUS_MILES * Math.asin(Math.min(1, Math.sqrt(haversine)));
  }
  return Math.max(0.01, Number(distance.toFixed(2)));
}

export function createInternetHike(
  trail: InternetTrailResult,
  datasetUpdatedAt = new Date().toISOString(),
): HikeDetail {
  const sourceLines =
    trail.geometry.type === "LineString"
      ? [trail.geometry.coordinates]
      : trail.geometry.coordinates;
  const lines = sourceLines
    .map((line) => ({ line, distanceMiles: lineDistanceMiles(line) }))
    .sort((left, right) => right.distanceMiles - left.distanceMiles)
    .slice(0, 8);
  const routes = lines.map(({ line, distanceMiles }, index) => {
    return {
      type: "Feature" as const,
      geometry: {
        type: "LineString" as const,
        coordinates: line.map(
          ([longitude, latitude]) => [longitude, latitude, 0] as const,
        ),
      },
      properties: {
        id: `${trail.id}-branch-${index + 1}`,
        name:
          sourceLines.length === 1
            ? trail.name
            : `${trail.name} · branch ${index + 1}`,
        source: trail.source,
        sourceUrl: trail.sourceUrl,
        datasetUpdatedAt,
        segmentIds: [index + 1],
        legalStatus: "unknown" as const,
        accessStatus: "unknown" as const,
        restrictions: [],
        condition: "unknown" as const,
        dataQuality: "preview" as const,
        distanceMiles,
        elevationSource: "not-provided" as const,
        elevationGainFeet: 0,
        estimatedMinutes: Math.max(5, Math.ceil((distanceMiles / 2) * 60)),
        exposure: "unknown" as const,
      },
    };
  });

  const distanceMiles = Number(
    routes
      .reduce((sum, route) => sum + route.properties.distanceMiles, 0)
      .toFixed(2),
  );
  return hikeDetailSchema.parse({
    id: `internet-${trail.id}`,
    name: trail.name,
    location: trail.location,
    difficulty:
      distanceMiles < 2 ? "easy" : distanceMiles < 6 ? "moderate" : "hard",
    distanceMiles: Math.max(0.01, distanceMiles),
    elevationGainFeet: 0,
    routes,
  });
}

export function hikeWeatherLocation(hike: HikeDetail):
  | {
      latitude: number;
      longitude: number;
    }
  | undefined {
  const coordinate = hike.routes[0]?.geometry.coordinates[0];
  return coordinate
    ? { longitude: coordinate[0], latitude: coordinate[1] }
    : undefined;
}
