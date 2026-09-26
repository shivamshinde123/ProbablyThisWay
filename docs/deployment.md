# Deployment Runbook

## Supported topology

The repository ships a provider-neutral Docker Compose topology:

```text
browser -> web (Nginx :8080) -> /api/* -> api (Fastify :3001) -> PostgreSQL 17
                                      -> Open-Meteo / optional Jev
                   migrate (one-shot) -> PostgreSQL before API startup
```

The web image builds `VITE_API_BASE_URL=/api/v1`, so browser API traffic remains same-origin. Nginx forwards only `/api/*` to the internal API service. The API image runs as the unprivileged `node` user and exposes a store-backed readiness check. Compose waits for PostgreSQL, completes tracked migrations, starts the API, and then starts the web service.

## Required operator values

Create a local `.env` file that is never committed:

```dotenv
POSTGRES_PASSWORD=replace-with-a-long-url-safe-password
STATE_ADAPTER_TOKEN=replace-with-at-least-32-random-characters
CORS_ALLOWED_ORIGINS=https://your-public-host.example
VITE_CESIUM_ION_ACCESS_TOKEN=
WEATHER_API_KEY=
JEV_API_KEY=
```

`POSTGRES_PASSWORD` and `STATE_ADAPTER_TOKEN` are required. Provider keys are optional: the Cesium token enables terrain, a weather key is needed only for a paid Open-Meteo plan, and a Jev key enables hosted evaluation. If the database password needs URL escaping, provide a complete URL-encoded `DATABASE_URL` override.

## Build and start

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
```

Verify `http://localhost:8080/healthz`, `http://localhost:8080/api/v1/health/live`, and `http://localhost:8080/api/v1/health/ready`. Then load the application and complete one field-session flow. Inspect structured logs with `docker compose logs api migrate`.

## Update and rollback

Before an update, back up the PostgreSQL volume using the hosting provider's snapshot mechanism. Build immutable image tags from a reviewed commit, run the one-shot migration, and replace the API/web services only after it succeeds. Roll back application images to the previous tag if needed. Database migrations are forward-only and checksum-protected; never edit an applied migration. A schema rollback requires a new reviewed migration or restoration from the pre-deploy backup.

## Provider handoff

The target cloud, DNS, TLS termination, managed PostgreSQL instance, secret manager, image registry, backups, alerts, and horizontal-scaling design are operator choices. Preserve the same service ordering, readiness paths, persistent database, and same-origin `/api` routing when translating this topology to a platform.