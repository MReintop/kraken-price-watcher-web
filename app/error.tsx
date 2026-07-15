'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/errorState/ErrorState';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  // The digest is all that reaches the browser in production, so a report of
  // "it broke" can only be matched to a cause if it is logged here too.
  useEffect(() => {
    console.error('Route error:', error.digest, error);
  }, [error]);

  return <ErrorState onRetry={reset} />;
}
