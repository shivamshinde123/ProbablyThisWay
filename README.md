# ProbablyThisWay

[![CI](https://github.com/shivamshinde123/ProbablyThisWay/actions/workflows/ci.yml/badge.svg)](https://github.com/shivamshinde123/ProbablyThisWay/actions/workflows/ci.yml)

ProbablyThisWay is a map-first hiking decision-support experiment built to explore [TypeSafe AI's Jev model](https://www.typesafe.ai/) through OpenRouter. Search for a trail, analyze its mapped route alternatives against current conditions, and watch the recommendation play out on interactive 3D terrain.

> [!IMPORTANT]
> ProbablyThisWay is an experimental decision-support tool, not a navigation system or safety guarantee. Always check official trail guidance, closures, weather alerts, and posted signs before hiking.

## Demo

This 13-second walkthrough searches for Newton Hill in Worcester, Massachusetts, starts the trail analysis, and previews the result on the interactive terrain view.

https://github.com/user-attachments/assets/b71e4233-194e-4f19-bf4c-5411a760fb05

## How it works

1. **Search for a trail or place.** The API searches OpenStreetMap by name and location. A query such as `Newton Hill, Worcester, MA, USA` can resolve directly to mapped trail lines or to nearby paths around a named place.
2. **Build a trail snapshot.** After selection, the API stores the geometry and known route facts. It also retrieves current conditions from Open-Meteo for the trail's starting coordinates.
3. **Score every mapped candidate.** The API sends the same structured snapshot to Jev through OpenRouter's typed Decisions API. Jev considers known weather, daylight, distance, duration, elevation gain, exposure, condition, pace, fatigue, and data quality. Unknown facts remain unknown.
4. **Apply application policy.** Jev supplies a suitability score, confidence, and probability distribution for each candidate. It does **not** make the final selection directly. Deterministic policy removes ineligible routes and selects the highest-scoring eligible candidate.
5. **Show the evidence.** The interface keeps the shared inputs, every route score, policy checks, exclusions, and final explanation available after analysis. It displays structured decision evidence, not private model chain-of-thought.
6. **Replay the route.** A marker travels from start to finish on a Cesium 3D terrain view while the model-to-policy stages replay alongside it. The animation is a route preview, not live GPS.

If `OPENROUTER_API_KEY` is missing or Jev returns an invalid response, the session still starts with an explicitly labeled deterministic baseline. The interface always identifies which provider produced the scores.

## Features

- Search internet trail data by trail name and location through OpenStreetMap.
- Analyze direct trail lines or up to eight named branches near a mapped place.
- Score candidates with the Jev-only `~typesafe/jev-latest` alias through OpenRouter.
- Display current weather, daylight, data freshness, and provider attribution.
- Explore 3D terrain with mouse, touch, zoom, pan, and route-framing controls.
- Play, pause, restart, and collapse the animated trail preview.
- Replay model-score and deterministic-policy stages with the route animation.
- Inspect the complete persisted decision explanation after playback.
- Reconnect automatically after temporary local API restarts.
- Use PostgreSQL in production or an in-memory store during local development.

## Technology

| Area             | Technology                                                            |
| ---------------- | --------------------------------------------------------------------- |
| Web interface    | React 19, TypeScript, Vite                                            |
| 3D mapping       | CesiumJS with ArcGIS World Elevation or optional Cesium World Terrain |
| API              | Node.js 22, Fastify, Zod                                              |
| Decision scoring | TypeSafe AI Jev through OpenRouter's Decisions API                    |
| Trail discovery  | OpenStreetMap Nominatim and bounded OSM map extracts                  |
| Weather          | Open-Meteo Forecast API                                               |
| Persistence      | PostgreSQL 17 in production; in-memory store locally                  |
| Testing          | Node test runner, Playwright, TypeScript, ESLint, Prettier            |

## Architecture

```text
Browser
  |
  | same-origin /api requests
  v
React + Cesium ------> Fastify API ------> OpenStreetMap
                           |  |----------> Open-Meteo
                           |  `----------> OpenRouter Decisions API -> Jev
                           |
                           `-------------> PostgreSQL (production)
                                           or in-memory store (local)
```

The browser never receives provider secrets. The API validates and normalizes external responses, runs evaluation and recommendation policy, and persists the resulting decision record.

## Quick start

### Prerequisites

- Node.js 22 or newer
- npm
- A browser with WebGL support

PostgreSQL, SQLite, Docker, and provider API keys are **not required** for a basic local run.

### 1. Clone and install

```bash
git clone https://github.com/shivamshinde123/ProbablyThisWay.git
cd ProbablyThisWay
npm install
```

### 2. Configure Jev through OpenRouter

The app runs without credentials, but it uses the deterministic baseline until an OpenRouter key is configured. To exercise Jev, copy the example environment file:

**macOS or Linux**

```bash
cp .env.example .env
```

**Windows PowerShell**

```powershell
Copy-Item .env.example .env
```

Then set this server-side value in the repository-root `.env`:

```dotenv
OPENROUTER_API_KEY=your_openrouter_key
```

Create the key at [OpenRouter](https://openrouter.ai/settings/keys). The application is locked to OpenRouter's Jev-only `~typesafe/jev-latest` alias; there is no generic model selector or chat-model fallback. Never commit `.env` or any credentials.

### 3. Start the application

```bash
npm run dev
```

Open <http://localhost:5173>. The Vite server forwards same-origin `/api/*` requests to the Fastify API at <http://localhost:3001>, so both processes should be started with the root command.

Try searching for:

```text
Newton Hill, Worcester, MA, USA
```

Select a result, choose **Analyze & start this trail**, and use **Frame 3D terrain** to position the camera around the mapped route.

## Configuration

Local API startup automatically reads an untracked repository-root `.env`. Browser-only Vite overrides belong in `apps/web/.env.local`.

| Variable                       | Local requirement | Purpose                                                                                                       |
| ------------------------------ | ----------------- | ------------------------------------------------------------------------------------------------------------- |
| `OPENROUTER_API_KEY`           | Optional          | Enables Jev scoring through OpenRouter. Without it, the app uses the labeled deterministic baseline.          |
| `OPENROUTER_DECISIONS_API_URL` | Optional          | Overrides the Decisions endpoint; defaults to `https://openrouter.ai/api/alpha/decisions` and must use HTTPS. |
| `WEATHER_API_BASE_URL`         | Optional          | Defaults to Open-Meteo's free/non-commercial Forecast endpoint.                                               |
| `WEATHER_API_KEY`              | Optional          | Only for Open-Meteo's paid Customer API. Do not use an OpenWeatherMap or WeatherAPI key.                      |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | Optional          | Uses Cesium World Terrain. Without it, the map uses keyless ArcGIS elevation terrain.                         |
| `DATABASE_URL`                 | Optional locally  | Enables durable PostgreSQL storage. Local sessions otherwise use memory and disappear on restart.             |
| `STATE_ADAPTER_TOKEN`          | Optional locally  | Protects server-to-server state updates; required in production and must contain at least 32 characters.      |
| `VITE_API_BASE_URL`            | Optional          | Browser API base; keep the default same-origin `/api/v1` for normal use.                                      |
| `VITE_API_PROXY_TARGET`        | Optional          | Development/preview proxy target; defaults to `http://127.0.0.1:3001`.                                        |

See the [environment configuration reference](docs/environment-config-reference.md) for every supported setting and its production requirements.

### Weather API choice

The default Open-Meteo Forecast endpoint is keyless for free/non-commercial use:

```dotenv
WEATHER_API_BASE_URL=https://api.open-meteo.com/v1/forecast
WEATHER_API_KEY=
```

For paid or commercial Open-Meteo access, use its Customer API endpoint and customer key. Other weather-provider keys are incompatible.

### Local persistence

You do not need SQLite or PostgreSQL for local development. If `DATABASE_URL` is absent, the API uses an in-memory store. Configure PostgreSQL and run the tracked migrations only when you need sessions to survive an API restart:

```bash
npm run db:migrate -w @probably-this-way/api
```

## Available commands

| Command                    | Purpose                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| `npm run dev`              | Build shared contracts and start the API and web development servers. |
| `npm run quality`          | Run ESLint and verify Prettier formatting.                            |
| `npm test`                 | Build contracts and run API unit and contract tests.                  |
| `npm run test:postgres`    | Run PostgreSQL integration tests; requires `TEST_DATABASE_URL`.       |
| `npm run check`            | Type-check the API and web workspaces.                                |
| `npm run build`            | Create production API and web artifacts.                              |
| `npm run test:e2e`         | Build the application and run desktop/mobile Chromium flows.          |
| `npm run data:refresh:dcr` | Regenerate the reviewed Massachusetts DCR route snapshot.             |

Before opening a pull request, run:

```bash
npm run quality
npm test
npm run check
npm run build
npm run test:e2e
```

## Production with Docker Compose

The included Compose topology runs PostgreSQL, a one-shot migration service, the Fastify API, and an Nginx web server. Create an untracked `.env` with at least:

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-url-safe-password
STATE_ADAPTER_TOKEN=replace-with-at-least-32-random-characters
```

Add `OPENROUTER_API_KEY` to enable Jev in production, then run:

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Open <http://localhost:8080>. See the [deployment runbook](docs/deployment.md) for health checks, secrets, updates, rollback, backups, and current scaling limits.

## Repository structure

```text
apps/
  api/                 Fastify API, adapters, evaluation, policy, and persistence
  web/                 React interface, Cesium terrain, and route playback
packages/
  contracts/           Shared Zod schemas and TypeScript types
tests/e2e/              Desktop and mobile browser flows
scripts/                Trail-data import tooling
docs/                   Product, architecture, API, data, and UI documentation
compose.yaml            Production-like local topology
```

## Data sources and limitations

- Search quality depends on OpenStreetMap coverage and naming. Not every physical trail is mapped or searchable.
- Internet-discovered geometry is unreviewed. Access, closures, exposure, condition, and elevation may be unavailable.
- Current weather is requested for the trail's starting coordinates and is refreshed every five minutes by default while a session is active.
- The animated marker previews the stored route geometry. It does not represent the user's location.
- The repository also contains a reviewed snapshot of three Massachusetts DCR summit corridors for reference and testing. That snapshot is not a live closure feed.
- Provider failures degrade visibly; they are not silently presented as fresh Jev or weather results.

OpenStreetMap, Open-Meteo, terrain, and trail-data attribution remains visible in the application where those sources are used.

## Documentation

- [Product requirements](docs/product-requirements-document.md)
- [System architecture](docs/system-architecture-document.md)
- [Technical design](docs/technical-design-document.md)
- [API specification](docs/api-specification.md)
- [Environment reference](docs/environment-config-reference.md)
- [Database schema](docs/database-schema.md)
- [Code flow](docs/flow.md)
- [Decision log](docs/decision.md)
- [UI/UX wireframes](docs/ui-ux-wireframes.md)
- [All project documentation](docs/)

## Support and contributions

Use [GitHub Issues](https://github.com/shivamshinde123/ProbablyThisWay/issues) for reproducible bugs or focused feature proposals. Changes should be made on a descriptive branch and submitted through a pull request; `main` is protected by CI and review requirements.
