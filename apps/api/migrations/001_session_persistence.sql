BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  id uuid PRIMARY KEY,
  hike_id text NOT NULL,
  selected_route_id text NOT NULL,
  status text NOT NULL CHECK (status = 'active'),
  created_at timestamptz NOT NULL,
  session_payload jsonb NOT NULL,
  last_evaluated_state jsonb NOT NULL,
  latest_decision jsonb NOT NULL,
  state_sequence integer NOT NULL DEFAULT 0 CHECK (state_sequence >= 0),
  event_sequence integer NOT NULL DEFAULT 0 CHECK (event_sequence >= 0),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS decision_events (
  id uuid PRIMARY KEY,
  session_id uuid NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  sequence integer NOT NULL CHECK (sequence > 0),
  event_type text NOT NULL CHECK (event_type IN ('session_started', 'recommendation_updated')),
  occurred_at timestamptz NOT NULL,
  payload jsonb NOT NULL,
  UNIQUE (session_id, sequence)
);

CREATE INDEX IF NOT EXISTS decision_events_session_time_idx
  ON decision_events (session_id, occurred_at);

COMMIT;
