# Environment Configuration Reference

These are the implemented runtime and build-time variables. Provider and server credentials are optional only where explicitly stated.

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `NODE_ENV` | Yes in production | No | Runtime environment; production value enables fail-closed security checks |
| `PORT` | No | No | API listen port; defaults to `3001` |
| `HOST` | No | No | API bind host; defaults to `127.0.0.1` |
| `WEB_ORIGIN` | No | No | Browser origin allowed by API CORS; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | No | No | Browser API base URL; defaults to `http://localhost:3001/api/v1` |
| `DATABASE_URL` | Yes in production | Yes | PostgreSQL connection used by the durable session/event store; omission selects the in-memory store only outside production |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | No | No | Optional scoped browser token selecting Cesium World Terrain; without it the map uses the public ArcGIS World Elevation terrain service |
| TRAIL_SEARCH_API_BASE_URL | No | No | Nominatim-compatible search endpoint; defaults to the public OpenStreetMap Nominatim search service and allows an operator-required provider switch |
| `WEATHER_API_BASE_URL` | Yes in production | No | Open-Meteo Forecast endpoint. Use `https://api.open-meteo.com/v1/forecast` for free/non-commercial keyless access, or `https://customer-api.open-meteo.com/v1/forecast` with a paid customer key |
| `WEATHER_API_KEY` | No | Yes | Open-Meteo Customer API key from `https://dashboard.open-meteo.com/`; leave empty for the public endpoint. Keys from OpenWeatherMap or WeatherAPI are incompatible |
| `WEATHER_REFRESH_INTERVAL_MS` | No | No | Active-session weather refresh cadence; defaults to `300000` (five minutes) and must be at least `60000` |
| `WEATHER_FRESHNESS_MAX_AGE_MS` | No | No | Maximum weather observation age; defaults to `1800000` (30 minutes), must be at least `900000`, and cannot be shorter than the refresh interval |
| `OPENROUTER_API_URL` | No | No | OpenRouter chat-completions endpoint; defaults to `https://openrouter.ai/api/v1/chat/completions` and must use HTTPS |
| `OPENROUTER_API_KEY` | No | Yes | Server-side OpenRouter key from `https://openrouter.ai/settings/keys`; absence enables the labeled deterministic baseline |
| `OPENROUTER_MODEL` | No | No | OpenRouter model ID; defaults to `openrouter/auto`. Pin a specific compatible model for predictable cost and behavior |
| `OPENROUTER_SITE_URL` | No | No | Optional site URL sent as OpenRouter `HTTP-Referer` attribution |
| `OPENROUTER_APP_NAME` | No | No | Optional OpenRouter application title; defaults to `ProbablyThisWay` |
| `STATE_ADAPTER_TOKEN` | Yes in production | Yes | Bearer credential for `PATCH /sessions/{sessionId}/state`; minimum 32 characters when configured |
| `LOG_LEVEL` | No | No | Fastify/Pino verbosity; defaults to `info`; accepts `trace`, `debug`, `info`, `warn`, `error`, `fatal`, or `silent` |
| `TRUST_PROXY` | No | No | Trust reverse-proxy forwarding headers; defaults to `false`; set only behind a controlled proxy such as the shipped Nginx service |
| `CORS_ALLOWED_ORIGINS` | Yes in production | No | Comma-separated browser origins; supersedes the single-origin `WEB_ORIGIN` fallback |
| `RATE_LIMIT_MAX` | No | No | Maximum non-health requests per process and client IP during the configured window; defaults to `120`; integer 1-10000 |
| `RATE_LIMIT_WINDOW_MS` | No | No | Rate-limit window in milliseconds; defaults to `60000`; integer 1000-3600000 |
| `EVENT_PAGE_SIZE` | No | No | Default decision-event page size; defaults to `50`; integer 1-100 |
| `SESSION_RETENTION_DAYS` | No | No | Delete sessions and cascading decision events after this many inactive days; defaults to `30`; integer 1-365 |
| `RETENTION_SWEEP_INTERVAL_MS` | No | No | Retention sweep cadence; defaults to `21600000` (six hours); integer 60000-86400000 |

## Rules

- Commit `.env.example` with names and safe placeholders only.
- Never expose server credentials to browser bundles.
- Treat a browser-visible Cesium token as public configuration: grant only the minimum scopes and restrict allowed origins. Never reuse a private server credential.
- Validate configuration at startup and fail with actionable errors.
- Use environment-specific secret management in deployed environments.
- Document defaults beside the implementation; do not give production secrets defaults.
