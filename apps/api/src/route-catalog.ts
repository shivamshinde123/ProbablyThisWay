import { hikeDetailSchema, routeFeatureSchema, type HikeDetail } from "@probably-this-way/contracts";
import { wachusettRoutes } from "./generated/wachusett-routes.js";
import type { WeatherLocation } from "./weather-adapter.js";

const routes = wachusettRoutes.map((route) => routeFeatureSchema.parse(route));

export const hikeDetails: Record<string, HikeDetail> = {
  "wachusett-summit": hikeDetailSchema.parse({
    id: "wachusett-summit",
    name: "Wachusett Summit Access Trails",
    location: "Princeton and Westminster, Massachusetts",
    difficulty: "hard",
    distanceMiles: 1.4,
    elevationGainFeet: 750,
    routes,
  }),
};

export const hikeWeatherLocations: Record<string, WeatherLocation> = {
  "wachusett-summit": { latitude: 42.4889, longitude: -71.8868 },
};
