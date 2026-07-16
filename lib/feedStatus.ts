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

// `connecting` counts as current only because the socket never returns to it: it
// means the server's fresh seed, and a reconnect stays `offline` until a ticker,
// so a dead socket's last price never reaches here.
export const isPriceCurrent = (status: EffectiveStatus) =>
  status === 'live' || status === 'connecting';
