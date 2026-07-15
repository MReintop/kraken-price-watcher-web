import { Suspense } from 'react';
import Markets from '@/components/markets/Markets';
import MarketsSkeleton from '@/components/markets/MarketsSkeleton';
import MarketSummary from '@/components/marketSummary/MarketSummary';
import MarketSummarySkeleton from '@/components/marketSummary/MarketSummarySkeleton';
import styles from './page.module.css';

export default function Home() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Markets</h1>

      <Suspense fallback={<MarketSummarySkeleton />}>
        <MarketSummary />
      </Suspense>

      <Suspense fallback={<MarketsSkeleton />}>
        <Markets />
      </Suspense>
    </main>
  );
}
