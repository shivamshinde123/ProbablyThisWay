# Data Extraction Specification

## Sources

| Data | Expected source | Output |
|---|---|---|
| Trail geometry | Authoritative trail/geospatial dataset; TBD | Validated GeoJSON LineString/MultiLineString |
| Terrain/elevation | Cesium-compatible terrain provider; TBD | Terrain reference plus sampled elevations |
| Weather | Configured Open-Meteo forecast endpoint | Temperature (F), wind (mph), precipitation probability, observation time, provider provenance |
| Time/daylight | Open-Meteo daily sunset when configured; static development fallback otherwise | UTC sunset and non-negative remaining minutes |
| Position/progress | Post-MVP GPS adapter | Point, accuracy, route progress; unavailable in the MVP unless a real supported source is added |
| User state | User-entered/session-derived facts | Pace, fatigue, experience, goal |

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

Production adapters preserve `observedAt`, server-side `receivedAt`, source, provider, license, and attribution URL; a provider-specific freshness ceiling remains TBD. The Open-Meteo adapter requests UTC timestamps plus explicit Fahrenheit and mph units, converts precipitation percentage to a 0-1 probability, and uses the day/night signal to clamp overnight daylight to zero. The session contract rejects out-of-order observations and re-evaluates at the documented deterministic thresholds. Stale values must not be labeled current.

Without a real position source, the MVP does not calculate route progress. The UI omits it or labels it unavailable.

## Simulation Exclusion

No UI action or data pipeline generates artificial condition changes for the product workflow. Test fixtures may use synthetic data inside automated tests and must be clearly isolated from production data.

## Data Quality Checks

Geometry continuity, route/trail proximity, elevation outliers, unit consistency, timestamp ordering, duplicate observations, and impossible speeds must be checked.
## Preview Fixtures

Prototype geometry may be used only to exercise contracts and rendering before an authoritative dataset is selected. It must carry `source: prototype-seed` and `dataQuality: preview`, remain visibly labeled as non-navigational, and never enter route recommendations or safety evaluation. Replacing it with licensed authoritative geometry is required before production use.
