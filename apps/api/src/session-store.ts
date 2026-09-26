import {
  decisionEventSchema,
  hikingStateSchema,
  latestDecisionSchema,
  sessionSchema,
  type DecisionEvent,
  type HikingState,
  type LatestDecision,
  type Session,
} from "@probably-this-way/contracts";
import { Pool, type PoolClient, type PoolConfig } from "pg";
import { z } from "zod";

const sessionRecordSchema = z.object({
  session: sessionSchema,
  decision: latestDecisionSchema,
  sequence: z.number().int().nonnegative(),
  lastEvaluatedState: hikingStateSchema,
  eventSequence: z.number().int().nonnegative(),
  events: z.array(decisionEventSchema),
});

export type SessionRecord = {
  session: Session;
  decision: LatestDecision;
  sequence: number;
  lastEvaluatedState: HikingState;
  eventSequence: number;
  events: DecisionEvent[];
};

export interface SessionStore {
  create(record: SessionRecord): Promise<void>;
  get(sessionId: string): Promise<SessionRecord | undefined>;
  listActiveSessionIds(): Promise<string[]>;
  save(record: SessionRecord, expectedSequence: number): Promise<boolean>;
  readiness(): Promise<void>;
  close(): Promise<void>;
}

function cloneRecord(record: SessionRecord): SessionRecord {
  return sessionRecordSchema.parse(structuredClone(record));
}

export class InMemorySessionStore implements SessionStore {
  readonly #records = new Map<string, SessionRecord>();

  async create(record: SessionRecord): Promise<void> {
    if (this.#records.has(record.session.id)) {
      throw new Error(`Session ${record.session.id} already exists`);
    }
    this.#records.set(record.session.id, cloneRecord(record));
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const record = this.#records.get(sessionId);
    return record ? cloneRecord(record) : undefined;
  }

  async listActiveSessionIds(): Promise<string[]> {
    return [...this.#records.values()]
      .filter((record) => record.session.status === "active")
      .map((record) => record.session.id);
  }

  async save(record: SessionRecord, expectedSequence: number): Promise<boolean> {
    const current = this.#records.get(record.session.id);
    if (!current || current.sequence !== expectedSequence) return false;
    this.#records.set(record.session.id, cloneRecord(record));
    return true;
  }

  async readiness(): Promise<void> {}

  async close(): Promise<void> {}
}

type StoredSessionRow = {
  session_payload: unknown;
  last_evaluated_state: unknown;
  latest_decision: unknown;
  state_sequence: number;
  event_sequence: number;
  events: unknown;
};

export class PostgresSessionStore implements SessionStore {
  readonly #pool: Pool;

  constructor(config: PoolConfig | Pool) {
    this.#pool = config instanceof Pool ? config : new Pool(config);
  }

  async create(record: SessionRecord): Promise<void> {
    const validated = cloneRecord(record);
    await this.#transaction(async (client) => {
      await client.query(
        `INSERT INTO sessions (
          id, hike_id, selected_route_id, status, created_at, session_payload,
          last_evaluated_state, latest_decision, state_sequence, event_sequence
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9, $10)`,
        [
          validated.session.id,
          validated.session.hikeId,
          validated.session.selectedRouteId,
          validated.session.status,
          validated.session.createdAt,
          JSON.stringify(validated.session),
          JSON.stringify(validated.lastEvaluatedState),
          JSON.stringify(validated.decision),
          validated.sequence,
          validated.eventSequence,
        ],
      );
      await this.#insertEvents(client, validated.events);
    });
  }

  async get(sessionId: string): Promise<SessionRecord | undefined> {
    const result = await this.#pool.query<StoredSessionRow>(
      `SELECT
        s.session_payload,
        s.last_evaluated_state,
        s.latest_decision,
        s.state_sequence,
        s.event_sequence,
        COALESCE(
          (SELECT jsonb_agg(e.payload ORDER BY e.sequence)
           FROM decision_events e
           WHERE e.session_id = s.id),
          '[]'::jsonb
        ) AS events
      FROM sessions s
      WHERE s.id = $1`,
      [sessionId],
    );
    const row = result.rows[0];
    if (!row) return undefined;
    return sessionRecordSchema.parse({
      session: row.session_payload,
      decision: row.latest_decision,
      sequence: row.state_sequence,
      lastEvaluatedState: row.last_evaluated_state,
      eventSequence: row.event_sequence,
      events: row.events,
    });
  }

  async listActiveSessionIds(): Promise<string[]> {
    const result = await this.#pool.query<{ id: string }>(
      "SELECT id FROM sessions WHERE status = 'active' ORDER BY created_at",
    );
    return result.rows.map((row) => row.id);
  }

  async save(record: SessionRecord, expectedSequence: number): Promise<boolean> {
    const validated = cloneRecord(record);
    return this.#transaction(async (client) => {
      const result = await client.query(
        `UPDATE sessions SET
          session_payload = $1::jsonb,
          last_evaluated_state = $2::jsonb,
          latest_decision = $3::jsonb,
          state_sequence = $4,
          event_sequence = $5,
          updated_at = NOW()
        WHERE id = $6 AND state_sequence = $7
        RETURNING id`,
        [
          JSON.stringify(validated.session),
          JSON.stringify(validated.lastEvaluatedState),
          JSON.stringify(validated.decision),
          validated.sequence,
          validated.eventSequence,
          validated.session.id,
          expectedSequence,
        ],
      );
      if (result.rowCount !== 1) return false;
      await this.#insertEvents(client, validated.events);
      return true;
    });
  }

  async close(): Promise<void> {
    await this.#pool.end();
  }

  async readiness(): Promise<void> {
    await this.#pool.query("SELECT 1");
  }

  async #insertEvents(client: PoolClient, events: DecisionEvent[]): Promise<void> {
    for (const event of events) {
      await client.query(
        `INSERT INTO decision_events (
          id, session_id, sequence, event_type, occurred_at, payload
        ) VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        ON CONFLICT (session_id, sequence) DO NOTHING`,
        [event.id, event.sessionId, event.sequence, event.type, event.occurredAt, JSON.stringify(event)],
      );
    }
  }

  async #transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.#pool.connect();
    try {
      await client.query("BEGIN");
      const result = await operation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
}

export function createSessionStore(env: NodeJS.ProcessEnv = process.env): SessionStore {
  const connectionString = env.DATABASE_URL?.trim();
  if (connectionString) return new PostgresSessionStore({ connectionString });
  if (env.NODE_ENV === "production") {
    throw new Error("DATABASE_URL is required when NODE_ENV=production");
  }
  return new InMemorySessionStore();
}
