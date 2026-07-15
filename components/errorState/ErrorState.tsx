'use client';

import styles from './ErrorState.module.css';

interface ErrorStateProps {
  onRetry: () => void;
}

export default function ErrorState({ onRetry }: ErrorStateProps) {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Prices are unavailable</h1>
      <p className={styles.body}>
        The market data feed did not answer. Nothing is wrong with your
        connection — this page reads from CoinGecko and Kraken, and one of them
        is having a moment.
      </p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Try again
      </button>
    </main>
  );
}
