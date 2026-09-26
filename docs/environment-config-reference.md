# Environment Configuration Reference

Implemented variables and planned integrations are listed below. Planned entries remain marked `TBD`.

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `NODE_ENV` | Yes in production | No | Runtime environment; production value enables fail-closed security checks |
| `PORT` | No | No | API listen port; defaults to `3001` |
| `HOST` | No | No | API bind host; defaults to `127.0.0.1` |
| `WEB_ORIGIN` | No | No | Browser origin allowed by API CORS; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | No | No | Browser API base URL; defaults to `http://localhost:3001/api/v1` |
| `DATABASE_URL` | Yes in production | Yes | PostgreSQL connection used by the durable session/event store; omission selects the in-memory store only outside production |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | No | No | Scoped browser token enabling Cesium World Terrain; without it the map uses an ellipsoid preview |
| `WEATHER_API_BASE_URL` | Yes in production | No | HTTPS Open-Meteo Forecast endpoint; setting it enables live weather/daylight at session start |
| `WEATHER_API_KEY` | No | Yes | Optional Open-Meteo commercial subscription key, sent only by the server |
| `WEATHER_REFRESH_INTERVAL_MS` | No | No | Active-session weather refresh cadence; defaults to `300000` (five minutes) and must be at least `60000` |
| `WEATHER_FRESHNESS_MAX_AGE_MS` | No | No | Maximum weather observation age; defaults to `1800000` (30 minutes), must be at least `900000`, and cannot be shorter than the refresh interval |
| `JEV_API_URL` | No | No | Server-side Jev endpoint; defaults to `https://www.jevai.org/api/v1/decisions` |
| `JEV_API_KEY` | No | Yes | Server-side Jev bearer credential; absence enables the labeled deterministic baseline |
| `STATE_ADAPTER_TOKEN` | Yes in production | Yes | Bearer credential for `PATCH /sessions/{sessionId}/state`; minimum 32 characters when configured |
| `LLM_API_KEY` | TBD | Yes | Optional question/explanation provider credential |
| `LOG_LEVEL` | No | No | Fastify/Pino verbosity; defaults to `info`; accepts `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent` |
| `CORS_ALLOWED_ORIGINS` | Yes in production | No | Comma-separated browser origins; supersedes the single-origin `WEB_ORIGIN` fallback |
| `RATE_LIMIT_MAX` | No | No | Maximum non-health requests per process and client IP during the configured window; defaults to `120`; integer 1-10000 |
| `RATE_LIMIT_WINDOW_MS` | No | No | Rate-limit window in milliseconds; defaults to `60000`; integer 1000-3600000 |
| `EVENT_PAGE_SIZE` | No | No | Default decision-event page size; defaults to `50`; integer 1-100 |

## Rules

- Commit `.env.example` with names and safe placeholders only.
- Never expose server credentials to browser bundles.
- Treat a browser-visible Cesium token as public configuration: grant only the minimum scopes and restrict allowed origins. Never reuse a private server credential.
- Validate configuration at startup and fail with actionable errors.
- Use environment-specific secret management in deployed environments.
- Document defaults beside the implementation; do not give production secrets defaults.
