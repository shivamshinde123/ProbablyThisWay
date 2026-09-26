BEGIN;

CREATE INDEX IF NOT EXISTS sessions_updated_at_idx
  ON sessions (updated_at);

COMMIT;