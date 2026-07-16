import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getCoin, getCoinCandles, getCoins } from '@/lib/coins';
import CoinPriceHeader from '@/components/coinPriceHeader/CoinPriceHeader';
import CoinChart from '@/components/coinChart/CoinChart';
import styles from './page.module.css';

interface CoinDetailPageProps {
  params: Promise<{ id: string }>;
}

export async function generateStaticParams() {
  const coins = await getCoins();
  return coins.map((coin) => ({ id: coin.id }));
}

export async function generateMetadata({ params }: CoinDetailPageProps) {
  const { id } = await params;
  const coin = await getCoin(id);
  return { title: coin ? `${coin.name} — Kraken Price Watcher` : 'Not found' };
}

export default async function CoinDetailPage({ params }: CoinDetailPageProps) {
  const { id } = await params;
  const coin = await getCoin(id);
  if (!coin) notFound();

  // Deliberate waterfall: the candles wait on the coin resolved above.
  const initialCandles = await getCoinCandles(coin.id, 30);

  return (
    <main className={styles.main}>
      <Link href="/" className={styles.back}>
        ← Markets
      </Link>

      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        className={styles.icon}
        src={coin.image}
        alt=""
        width={72}
        height={72}
      />
      <h1 className={styles.name}>
        {coin.name}
        <span className={styles.symbol}>{coin.symbol.toUpperCase()}</span>
      </h1>

      <CoinPriceHeader
        symbol={coin.symbol}
        priceDecimals={coin.price_decimals}
      />

      <CoinChart
        coinId={coin.id}
        symbol={coin.symbol}
        initialCandles={initialCandles}
        priceDecimals={coin.price_decimals}
        initialDays={30}
      />

      <div className={styles.stats}>
        <div className={styles.stat}>
          <span className={styles.statLabel}>Market cap</span>
          <span>${coin.market_cap.toLocaleString()}</span>
        </div>
        <div className={styles.stat}>
          <span className={styles.statLabel}>24h volume</span>
          <span>${coin.total_volume.toLocaleString()}</span>
        </div>
      </div>
    </main>
  );
}
