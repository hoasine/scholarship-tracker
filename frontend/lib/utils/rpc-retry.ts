export function isTransientRpcError(err: unknown): boolean {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  const lower = raw.toLowerCase();
  return (
    lower.includes("rate limited") ||
    lower.includes("rate limit") ||
    lower.includes("429") ||
    lower.includes("too many requests") ||
    lower.includes("reading 'json'") ||
    lower.includes('reading "json"') ||
    lower.includes("unexpected end of json") ||
    lower.includes("failed to fetch") ||
    lower.includes("network error") ||
    lower.includes("fetch failed") ||
    lower.includes("gateway timeout") ||
    lower.includes("502") ||
    lower.includes("503") ||
    lower.includes("504") ||
    lower.includes("unknown rpc error") ||
    lower.includes("http request failed")
  );
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

/**
 * Keep retrying transient GenLayer RPC failures for up to `timeoutMs`
 * instead of failing the UI on the first 429 / empty JSON response.
 */
export async function withTransientRpcRetry<T>(
  fn: () => Promise<T>,
  options?: {
    timeoutMs?: number;
    onRetry?: (info: {
      attempt: number;
      waitMs: number;
      remainingMs: number;
      error: unknown;
    }) => void;
  }
): Promise<T> {
  const timeoutMs = options?.timeoutMs ?? 60_000;
  const started = Date.now();
  let attempt = 0;
  let lastError: unknown;

  while (true) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (!isTransientRpcError(err)) throw err;

      const elapsed = Date.now() - started;
      const remainingMs = timeoutMs - elapsed;
      if (remainingMs <= 500) break;

      attempt += 1;
      // 3s, 6s, 9s… capped at 12s, never exceeding remaining budget
      const waitMs = Math.min(remainingMs - 100, Math.min(12_000, 3000 * attempt));
      options?.onRetry?.({ attempt, waitMs, remainingMs, error: err });
      await sleep(Math.max(1000, waitMs));
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(String(lastError ?? "RPC request failed after retries"));
}
