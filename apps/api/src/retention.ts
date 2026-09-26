import type { SessionStore } from "./session-store.js";

export const DEFAULT_SESSION_RETENTION_DAYS = 30;
export const DEFAULT_RETENTION_SWEEP_INTERVAL_MS = 21_600_000;

function integer(
  value: string | undefined,
  fallback: number,
  name: string,
  minimum: number,
  maximum: number,
) {
  if (!value?.trim()) return fallback;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new Error(`${name} must be an integer from ${minimum} to ${maximum}`);
  }
  return parsed;
}

export function resolveRetentionConfig(env: NodeJS.ProcessEnv = process.env) {
  const days = integer(
    env.SESSION_RETENTION_DAYS,
    DEFAULT_SESSION_RETENTION_DAYS,
    "SESSION_RETENTION_DAYS",
    1,
    365,
  );
  return {
    retentionMs: days * 86_400_000,
    sweepIntervalMs: integer(
      env.RETENTION_SWEEP_INTERVAL_MS,
      DEFAULT_RETENTION_SWEEP_INTERVAL_MS,
      "RETENTION_SWEEP_INTERVAL_MS",
      60_000,
      86_400_000,
    ),
  };
}

export class RetentionSweeper {
  #timer?: NodeJS.Timeout;

  constructor(
    private readonly options: {
      sessionStore: SessionStore;
      retentionMs: number;
      sweepIntervalMs: number;
      onError: (error: unknown) => void;
      now?: () => number;
    },
  ) {}

  start() {
    if (this.#timer) return;
    this.#timer = setInterval(
      () => void this.sweep().catch(this.options.onError),
      this.options.sweepIntervalMs,
    );
    this.#timer.unref();
  }

  stop() {
    if (this.#timer) clearInterval(this.#timer);
    this.#timer = undefined;
  }

  async sweep() {
    const now = this.options.now?.() ?? Date.now();
    return this.options.sessionStore.purgeExpired(
      new Date(now - this.options.retentionMs),
    );
  }
}
