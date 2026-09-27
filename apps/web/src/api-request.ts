const RETRYABLE_STATUS_CODES = new Set([408, 425, 429, 500, 502, 503, 504]);

type RetryOptions = {
  attempts?: number;
  baseDelayMs?: number;
};

export class ApiRequestError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "ApiRequestError";
  }
}

function waitForRetry(delayMs: number, signal?: AbortSignal | null) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException("Request aborted", "AbortError"));
      return;
    }
    const timeout = window.setTimeout(() => {
      signal?.removeEventListener("abort", handleAbort);
      resolve();
    }, delayMs);
    function handleAbort() {
      window.clearTimeout(timeout);
      reject(new DOMException("Request aborted", "AbortError"));
    }
    signal?.addEventListener("abort", handleAbort, { once: true });
  });
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init: RequestInit = {},
  { attempts = 5, baseDelayMs = 250 }: RetryOptions = {},
) {
  const method = (init.method ?? "GET").toUpperCase();
  const canRetry = method === "GET" || method === "HEAD";
  const maximumAttempts = canRetry ? Math.max(1, attempts) : 1;
  let lastNetworkError: unknown;

  for (let attempt = 1; attempt <= maximumAttempts; attempt += 1) {
    try {
      const response = await fetch(input, init);
      const shouldRetry =
        RETRYABLE_STATUS_CODES.has(response.status) &&
        attempt < maximumAttempts;
      if (!shouldRetry) return response;
      await response.body?.cancel();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError")
        throw error;
      lastNetworkError = error;
      if (attempt === maximumAttempts) break;
    }
    await waitForRetry(baseDelayMs * 2 ** (attempt - 1), init.signal);
  }

  throw new ApiRequestError(
    lastNetworkError instanceof Error
      ? lastNetworkError.message
      : "The API could not be reached",
  );
}

export async function fetchJson<T>(
  input: RequestInfo | URL,
  parse: (value: unknown) => T,
  init: RequestInit = {},
  retryOptions?: RetryOptions,
) {
  const response = await fetchWithRetry(input, init, retryOptions);
  if (!response.ok) {
    throw new ApiRequestError(
      `The API returned HTTP ${response.status}`,
      response.status,
    );
  }
  return parse(await response.json());
}

export function describeApiFailure(error: unknown, fallback: string) {
  if (error instanceof ApiRequestError) {
    return error.status
      ? `${fallback} The API returned HTTP ${error.status}.`
      : `${fallback} The local API could not be reached.`;
  }
  return `${fallback} The API returned an invalid response.`;
}
