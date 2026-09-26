# Coding Conventions

## General

- Use TypeScript strict mode and avoid `any` unless an adapter boundary documents why.
- Prefer small, single-purpose modules and explicit dependency injection at integration boundaries.
- Name domain concepts consistently: `Hike`, `Trail`, `Route`, `HikingState`, `Evaluation`, and `DecisionEvent`.
- Represent units in names (`distanceMeters`, `windMph`) or with validated unit types; never rely on implication.
- Use UTC timestamps and immutable input snapshots for evaluations.

## React

- Keep domain and server state out of visual-only components.
- Favor composition and hooks over inheritance.
- Provide loading, empty, error, stale, and success states.
- Keep Cesium lifecycle code in dedicated map adapters/hooks.
- Meet keyboard, contrast, focus, and reduced-motion accessibility needs.

## Backend

- Validate requests and external responses at runtime.
- Keep controllers thin: parse, authorize, call a use case, serialize.
- Do not place route-selection policy in controllers or React components.
- Use structured errors and logs; do not swallow exceptions.
- Make retries bounded and safe through idempotency.
- Parameterize every SQL value; never build SQL by concatenating request or domain data.
- Use one checked-out database client for every multi-statement transaction and release it in `finally`.
- Validate JSON read from persistence with shared schemas before returning it to application code.

## Quality

- Format and lint automatically; exact tools are TBD.
- Add tests for changed domain behavior.
- Document material architectural decisions.
- Never commit credentials or real user location fixtures.
