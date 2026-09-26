# Database Schema

PostgreSQL with PostGIS is the planned store. Names and types below are logical; migrations are TBD.

## Core Tables

### `hikes`

`id`, `name`, `description`, `difficulty`, `bounds`, `terrain_config`, `status`, timestamps.

### `trails`

`id`, `hike_id` FK, `name`, `geometry geography`, `distance_meters`, `elevation_gain_meters`, `source`, `source_version`, timestamps.

### `routes`

`id`, `hike_id` FK, `name`, `geometry geography`, `distance_meters`, `elevation_gain_meters`, `estimated_duration_seconds`, `attributes jsonb`, `active`, timestamps.

### `sessions`

`id`, `hike_id` FK, `status`, `started_at`, `ended_at`, `user_profile jsonb`. User/account FK is TBD.

### `hiking_state_snapshots`

`id`, `session_id` FK, `sequence`, `observed_at`, `position geography NULL`, weather/time/pace/fatigue fields, `source_metadata jsonb`, `created_at`. Unique `(session_id, sequence)`.

### `evaluations`

`id`, `session_id` FK, `state_snapshot_id` FK, `question_set_version`, `status`, `selected_route_id` FK NULL, `policy_version`, `explanation`, timestamps, `idempotency_key` unique.

### `route_scores`

`evaluation_id` FK, `route_id` FK, `suitability`, `constraint_status`, `answers jsonb`, `factors jsonb`. Primary key `(evaluation_id, route_id)`.

### `decision_events`

`id`, `session_id` FK, `evaluation_id` FK NULL, `sequence`, `event_type`, `payload jsonb`, `occurred_at`. Unique `(session_id, sequence)`.

## Relationships

One hike has trails and routes. One session belongs to a hike and has ordered state snapshots, evaluations, and events. One evaluation references one snapshot and has one score per candidate route.

## Indexes and Retention

Add GiST indexes to geometry/geography, B-tree indexes to foreign keys and chronological session queries, and retention rules for location/user-state data. Exact retention period is TBD.

## Current Prototype Storage

The implemented API uses a process-memory session record containing the current session snapshot, latest decision, accepted-update sequence, last evaluated snapshot, independent event sequence, and ordered decision events. It mirrors the ordering model above but is not durable and is cleared on restart. PostgreSQL/PostGIS migrations remain a production-stage requirement.
