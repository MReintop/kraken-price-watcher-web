import Link from 'next/link';
import styles from './not-found.module.css';

// Catches a bad URL and the coin detail page's notFound() alike, so it cannot
// name the coin that was asked for — hence the general wording.
export default function NotFound() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Not found</h1>
      <p className={styles.body}>
        That page isn&apos;t here. If you were after a coin, only the eight on
        the markets page are tracked.
      </p>
      <Link href="/" className={styles.back}>
        Back to markets
      </Link>
    </main>
  );
}
