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
// counts, and only because the socket never returns to it: it means no feed has
// arrived yet, so the price is the server's own fresh seed. A reconnect stays
// `offline` precisely so a dead socket's last price cannot pass through here.
export const isPriceCurrent = (status: EffectiveStatus) =>
  status === 'live' || status === 'connecting';
