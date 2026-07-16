const MAX_ATTEMPTS = 4;
const BASE_DELAY_MS = 500;

// Bounds one attempt. Failing is recoverable; hanging is not — without this, an
// upstream that accepts the connection and then says nothing holds a build
// worker, or a request, for as long as it feels like.
const TIMEOUT_MS = 5000;

// A server can ask for longer than anyone will wait. Uncapped, a Retry-After of
// an hour is an hour of a build worker held on one upstream's say-so.
const MAX_RETRY_AFTER_MS = 30_000;

export class AbortedError extends Error {
  constructor() {
    super('Request aborted');
    this.name = 'AbortedError';
  }
}

// Waiting is part of the request, so the caller's signal has to reach it: an
// unabortable sleep honours a Retry-After long after the caller has gone.
const sleep = (ms: number, signal?: AbortSignal | null) =>
  new Promise<void>((resolve, reject) => {
    if (signal?.aborted) return reject(new AbortedError());
    const settle = (finish: () => void) => () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      finish();
    };
    const onAbort = settle(() => reject(new AbortedError()));
    const timer = setTimeout(settle(resolve), ms);
    signal?.addEventListener('abort', onAbort);
  });

const isRetryable = (status: number) => status === 429 || status >= 500;

// Jitter, not just backoff: a build renders pages in parallel worker processes,
// so an unjittered retry would re-collide with the same siblings every attempt.
//
// Only the delta-seconds form of Retry-After is read; the HTTP-date form parses
// as NaN and falls through to the backoff.
export function retryDelayMs(attempt: number, retryAfter: string | null) {
  const seconds = Number(retryAfter);
  if (Number.isFinite(seconds) && seconds > 0) {
    return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
  }
  const backoff = BASE_DELAY_MS * 2 ** attempt;
  return backoff / 2 + Math.random() * backoff;
}

// Honours a caller's own signal alongside the timeout, rather than replacing it.
const attemptSignal = (caller: AbortSignal | null | undefined) => {
  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  return caller ? AbortSignal.any([caller, timeout]) : timeout;
};

// Retries only what a retry can fix. A 404 retried four times just wastes time,
// and a caller who walked away is not asking to be tried harder.
export async function fetchWithRetry(
  url: string,
  init: RequestInit,
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    if (init.signal?.aborted) throw new AbortedError();
    const lastAttempt = attempt >= MAX_ATTEMPTS - 1;

    let response: Response;
    try {
      response = await fetch(url, {
        ...init,
        signal: attemptSignal(init.signal),
      });
    } catch (error) {
      // A timeout, reset, or DNS failure has no status to read and is as worth
      // retrying as a 5xx. The caller's own abort is the exception — same aborted
      // fetch, but only a timeout wants another try.
      if (init.signal?.aborted) throw new AbortedError();
      if (lastAttempt) throw error;
      await sleep(retryDelayMs(attempt, null), init.signal);
      continue;
    }

    if (response.ok || lastAttempt || !isRetryable(response.status)) {
      return response;
    }
    await sleep(
      retryDelayMs(attempt, response.headers.get('retry-after')),
      init.signal,
    );
  }
}
