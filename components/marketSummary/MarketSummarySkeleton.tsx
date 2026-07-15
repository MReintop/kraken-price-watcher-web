import styles from './MarketSummary.module.css';

export default function MarketSummarySkeleton() {
  return (
    <div
      className={`${styles.summary} ${styles.summarySkeleton}`}
      aria-busy="true"
      aria-label="Loading summary"
    />
  );
}
