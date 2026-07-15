const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

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

// Retries only what a retry can fix. A 404 retried four times just wastes time.
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init);
    const lastAttempt = attempt >= MAX_ATTEMPTS - 1;
    if (response.ok || lastAttempt || !isRetryable(response.status)) {
      return response;
    }
    await sleep(retryDelayMs(attempt, response.headers.get('retry-after')));
  }
}
