'use client';

import { useEffect } from 'react';
import ErrorState from '@/components/errorState/ErrorState';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    console.error('Route error:', error.digest, error);
  }, [error]);

  return <ErrorState onRetry={reset} />;
}
