const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

// Bounds one attempt. Failing is recoverable; hanging is not — without this, an
// upstream that accepts the connection and then says nothing holds a build
// worker, or a request, for as long as it feels like.
const TIMEOUT_MS = 5000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const isRetryable = (status: number) => status === 429 || status >= 500;

// Jitter, not just backoff: a build renders pages in parallel worker processes,
// so an unjittered retry would re-collide with the same siblings every attempt.
export function retryDelayMs(attempt: number, retryAfter: string | null) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  const backoff = BASE_DELAY_MS * 2 ** attempt;
  return backoff / 2 + Math.random() * backoff;
}

// Honours a caller's own signal alongside the timeout, rather than replacing it.
const attemptSignal = (caller: AbortSignal | null | undefined) => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return caller ? AbortSignal.any([caller, timeout]) : timeout;
};

// Retries only what a retry can fix. A 404 retried four times just wastes time.
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const lastAttempt = attempt >= MAX_ATTEMPTS - 1;

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: attemptSignal(init.signal),
      });
    } catch (error) {
      // A timeout, a reset, a DNS failure: no status to read, and as worth
      // retrying as the 5xx below. Left uncaught, the first blip took the whole
      // page down.
      if (lastAttempt) throw error;
      await sleep(retryDelayMs(attempt, null));
      continue;
    }

    if (response.ok || lastAttempt || !isRetryable(response.status)) {
      return response;
    }
    await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
  }
}
