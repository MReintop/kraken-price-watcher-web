import type { EffectiveStatus } from '@/store/pricesSlice';

// One vocabulary for every screen: the same state named two ways is two states
// to the reader, and "not updating" and "not available" are different answers to
// "why is this number not moving?".
export const STATUS_LABEL: Record<EffectiveStatus, string> = {
  connecting: 'Connecting…',
  live: 'Live',
  stale: 'Not updating',
  offline: 'Reconnecting…',
  unavailable: 'Not available',
};

// Whether the number on screen is still the one Kraken last sent. `connecting`
// counts: that price is the server's own seed, current until the socket says
// otherwise. `stale` and `offline` do not — the feed is gone and the number is
// only the last one that arrived.
export const isPriceCurrent = (status: EffectiveStatus) =>
  status === 'live' || status === 'connecting';
