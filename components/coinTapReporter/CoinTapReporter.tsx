'use client';

import type { ReactNode } from 'react';
import { emitOutcome } from '@/lib/experiments/outcomeClient';

// Listens for the tap on the WHOLE card
export default function CoinTapReporter({ children }: { children: ReactNode }) {
  return <div onClickCapture={() => emitOutcome('coin_tap')}>{children}</div>;
}
