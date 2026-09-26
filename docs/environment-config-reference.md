# Environment Configuration Reference

Implemented variables and planned integrations are listed below. Planned entries remain marked `TBD`.

| Variable | Required | Secret | Purpose |
|---|---:|---:|---|
| `NODE_ENV` | Yes | No | Runtime environment |
| `PORT` | No | No | API listen port; defaults to `3001` |
| `HOST` | No | No | API bind host; defaults to `127.0.0.1` |
| `WEB_ORIGIN` | No | No | Browser origin allowed by API CORS; defaults to `http://localhost:5173` |
| `VITE_API_BASE_URL` | No | No | Browser API base URL; defaults to `http://localhost:3001/api/v1` |
| `DATABASE_URL` | Yes | Yes | PostgreSQL/PostGIS connection |
| `VITE_CESIUM_ION_ACCESS_TOKEN` | No | No | Scoped browser token enabling Cesium World Terrain; without it the map uses an ellipsoid preview |
| `WEATHER_API_BASE_URL` | TBD | No | Weather provider endpoint |
| `WEATHER_API_KEY` | TBD | Yes | Weather provider credential |
| `JEV_API_URL` | No | No | Server-side Jev endpoint; defaults to `https://www.jevai.org/api/v1/decisions` |
| `JEV_API_KEY` | No | Yes | Server-side Jev bearer credential; absence enables the labeled deterministic baseline |
| `LLM_API_KEY` | TBD | Yes | Optional question/explanation provider credential |
| `LOG_LEVEL` | No | No | Logging verbosity |
| `CORS_ALLOWED_ORIGINS` | Yes in production | No | Allowed web origins |

## Rules

- Commit `.env.example` with names and safe placeholders only.
- Never expose server credentials to browser bundles.
- Treat a browser-visible Cesium token as public configuration: grant only the minimum scopes and restrict allowed origins. Never reuse a private server credential.
- Validate configuration at startup and fail with actionable errors.
- Use environment-specific secret management in deployed environments.
- Document defaults beside the implementation; do not give production secrets defaults.
