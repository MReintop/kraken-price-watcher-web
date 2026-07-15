import Link from 'next/link';
import { getCoins } from '@/lib/coins';
import CoinPriceRow from '@/components/coinPriceRow/CoinPriceRow';
import styles from './Markets.module.css';

export default async function Markets() {
  const coins = await getCoins();

  return (
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

            {/* The only live part — a client leaf reading this coin's slice. */}
            <CoinPriceRow symbol={coin.symbol} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
