import styles from './Markets.module.css';

export default function MarketsSkeleton() {
  return (
    <ul className={styles.list} aria-busy="true" aria-label="Loading markets">
      {Array.from({ length: 8 }).map((_, i) => (
        <li key={i}>
          <div className={styles.cardSkeleton} />
        </li>
      ))}
    </ul>
  );
}
