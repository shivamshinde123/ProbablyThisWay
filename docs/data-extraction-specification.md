# Data Extraction Specification

## Sources

| Data              | Expected source                                                                        | Output                                                                                          |
| ----------------- | -------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Trail geometry    | Massachusetts DCR Roads and Trails ArcGIS layer                                        | Validated WGS84 GeoJSON LineString with dataset timestamp and feature IDs                       |
| Terrain/elevation | Cesium World Terrain when a token is configured; official DCR trail-map ascent metrics | Terrain-clamped geometry plus published route ascent                                            |
| Weather           | Configured Open-Meteo forecast endpoint                                                | Temperature (F), wind (mph), precipitation probability, observation time, provider provenance   |
| Time/daylight     | Open-Meteo daily sunset when configured; static development fallback otherwise         | UTC sunset and non-negative remaining minutes                                                   |
| Position/progress | Post-MVP GPS adapter                                                                   | Point, accuracy, route progress; unavailable in the MVP unless a real supported source is added |
| User state        | User-entered/session-derived facts                                                     | Pace, fatigue, experience, goal                                                                 |

## Pipeline

1. Fetch with provider-specific adapter.
2. Preserve source, license/provenance, fetch time, and observation time.
3. Validate schema, coordinate ranges, timestamps, and units.
4. Convert to canonical units and GeoJSON/WGS84 where applicable.
5. Reject or quarantine malformed records; never silently fabricate required values.
6. Derive route distance, elevation gain/loss, estimated time, exposure, and daylight margin.
7. Store normalized records and extraction version.
8. Provide immutable state snapshots to evaluations.

## Freshness

Production adapters preserve `observedAt`, server-side `receivedAt`, source, provider, license, and attribution URL. Open-Meteo observations use a configurable 30-minute freshness ceiling by default—twice the provider's documented 15-minute current-condition timestep—and become stale immediately when a scheduled refresh fails. The Open-Meteo adapter requests UTC timestamps plus explicit Fahrenheit and mph units, converts precipitation percentage to a 0-1 probability, and uses the day/night signal to clamp overnight daylight to zero. The session contract rejects out-of-order observations and re-evaluates at the documented deterministic thresholds. Stale values must not be labeled current.

Without a real position source, the MVP does not calculate route progress. The UI omits it or labels it unavailable.

## Simulation Exclusion

No UI action or data pipeline generates artificial condition changes for the product workflow. Test fixtures may use synthetic data inside automated tests and must be clearly isolated from production data.

## Data Quality Checks

Geometry continuity, route/trail proximity, elevation outliers, unit consistency, timestamp ordering, duplicate observations, and impossible speeds must be checked.

## Authoritative Wachusett Snapshot

Run `npm run data:refresh:dcr` to query the explicit reviewed DCR feature IDs. Generation fails if a segment is missing, marked illegal, malformed, or separated from the next segment by more than 20 meters. The committed snapshot preserves source URL, April 2024 dataset timestamp, feature IDs, condition, legal status, access status, and typed restrictions. DCR linework contains no elevation or exposure field; coordinates use zero for terrain clamping, official trail-map metrics supply ascent and duration, and exposure remains explicitly unknown.

## Runtime Internet Trail Search

Submitted trail searches first use OpenStreetMap Nominatim with full GeoJSON geometry and a simplification tolerance. Direct trail-like LineString and MultiLineString objects are retained. When the match is a point or non-linear place, the adapter centers a small OSM map extract on it, excludes private/no-access ways and sidewalk/crossing footways, ranks trail-like ways by tags, surface, distance, and length, and returns a place-labeled nearby network plus named paths. Dense extracts retry with a smaller bound. Mapped length is computed locally with the haversine formula, direct OSM object URLs and mandatory attribution are preserved, and all provider payloads are validated. Search results remain unreviewed discovery data. When a user starts one, each LineString (or each branch of a MultiLineString) is converted into a session-scoped candidate with locally calculated distance and time estimate; legal status, access, condition, exposure, and elevation stay `unknown` rather than being invented.

## Rendered Elevation Terrain

The no-token browser path initializes Cesium ArcGISTiledElevationTerrainProvider from the public WorldElevation3D Terrain3D ImageServer. A configured Cesium ion token instead selects Cesium World Terrain with vertex normals. Both paths depth-test and clamp route lines, points, and labels against terrain; service-provided credits remain visible. Provider initialization failure is reported in the map status and falls back visibly to the ellipsoid rather than claiming terrain is online.
