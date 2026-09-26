# ProbablyThisWay

ProbablyThisWay is a map-first hiking decision-support application. It presents real trails and route alternatives on 3D terrain, evaluates them against current conditions with Jev, and highlights an explainable recommendation.

## Status

The repository is in the planning and initial setup phase. Product, architecture, API, data, and UI specifications are maintained in [`docs/`](docs/).

## Core Principles

- Use authoritative geospatial data for trails and routes.
- Keep route selection deterministic and auditable.
- Treat LLM assistance as optional and outside the critical decision loop.
- Do not present recommendations as safety guarantees.
- Do not include simulated-condition controls.

## Development

Requires Node.js 22 or newer.

```bash
npm install
npm run dev
```

The web client runs at `http://localhost:5173` and the API at `http://localhost:3001`.

```bash
npm run check
npm run build
```
