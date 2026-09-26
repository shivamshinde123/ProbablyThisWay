import { timingSafeEqual } from "node:crypto";

const MINIMUM_TOKEN_LENGTH = 32;

export type AdapterAuthConfig = { token?: string };

export function resolveAdapterAuthConfig(env: NodeJS.ProcessEnv = process.env): AdapterAuthConfig {
  const token = env.STATE_ADAPTER_TOKEN?.trim();
  if (token && token.length < MINIMUM_TOKEN_LENGTH) {
    throw new Error(`STATE_ADAPTER_TOKEN must contain at least ${MINIMUM_TOKEN_LENGTH} characters`);
  }
  if (env.NODE_ENV === "production" && !token) {
    throw new Error("STATE_ADAPTER_TOKEN is required when NODE_ENV=production");
  }
  return token ? { token } : {};
}

export function isAuthorizedAdapter(authorization: string | undefined, config: AdapterAuthConfig): boolean {
  if (!config.token) return true;
  const match = /^Bearer ([^\s]+)$/i.exec(authorization ?? "");
  const suppliedToken = match?.[1];
  if (!suppliedToken) return false;
  const supplied = Buffer.from(suppliedToken);
  const expected = Buffer.from(config.token);
  return supplied.length === expected.length && timingSafeEqual(supplied, expected);
}
