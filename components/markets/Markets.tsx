import Link from 'next/link';
import { getCoins } from '@/lib/coins';
import CoinPriceRow from '@/components/coinPriceRow/CoinPriceRow';
import FeedStatus from '@/components/feedStatus/FeedStatus';
import styles from './Markets.module.css';

export default async function Markets() {
  const coins = await getCoins();

  return (
    <>
      <FeedStatus />
      <ul className={styles.list}>
        {coins.map((coin) => (
          <li key={coin.id}>
            <Link href={`/coins/${coin.id}`} className={styles.card}>
              <div className={styles.header}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.icon}
                  src={coin.image}
                  alt=""
                  width={32}
                  height={32}
                />
                <div className={styles.identity}>
                  <span className={styles.name}>{coin.name}</span>
                  <span className={styles.symbol}>
                    {coin.symbol.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* The only live part — a client leaf reading this coin's slice.
                The change comes with it as a prop: it is CoinGecko's, and the
                socket has no business replacing it with Kraken's. */}
              <CoinPriceRow
                symbol={coin.symbol}
                priceDecimals={coin.price_decimals}
                changePct={coin.price_change_percentage_24h}
              />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
