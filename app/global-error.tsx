'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/errorState/ErrorState';
import './globals.css';

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

// error.tsx cannot catch a throw from the root layout, and the root layout is
// where the market data is fetched — so an upstream outage renders this, not
// that. It replaces the layout entirely, hence the <html> it has to carry.
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error('Root error:', error.digest, error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <ErrorState onRetry={reset} />
      </body>
    </html>
  );
}
