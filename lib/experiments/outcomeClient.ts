'use client';

import type { OutcomeName } from './registry';

// Fire-and-forget: an outcome ride must never delay or break the interaction
// it measures. sendBeacon survives the navigation a coin tap causes (the
// browser owns the request after the page unloads); keepalive fetch is the
// fallback for environments without it. Failures are dropped silently — a
// lost outcome is noise, an interaction made to wait on analytics is a bug.
export function emitOutcome(name: OutcomeName): void {
  const payload = JSON.stringify({ name });
  try {
    if (
      typeof navigator !== 'undefined' &&
      typeof navigator.sendBeacon === 'function'
    ) {
      const ok = navigator.sendBeacon(
        '/api/outcomes',
        new Blob([payload], { type: 'application/json' }),
      );
      if (ok) return;
    }
    void fetch('/api/outcomes', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // deliberately nothing — see above
  }
}
