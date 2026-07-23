import Link from 'next/link';
import { getCoins } from '@/lib/coins';
import CoinPriceRow from '@/components/coinPriceRow/CoinPriceRow';
import CoinTapReporter from '@/components/coinTapReporter/CoinTapReporter';
import FeedStatus from '@/components/feedStatus/FeedStatus';
import styles from './Markets.module.css';

import { serverVariant } from '@/lib/experiments/server';
import { CHANGE_PILL_STYLE } from '@/lib/experiments';

export default async function Markets() {
  const coins = await getCoins();

  const pillVariant = await serverVariant(CHANGE_PILL_STYLE);

  return (
    <>
      <FeedStatus />
      <ul className={styles.list}>
        {coins.map((coin) => (
          <li key={coin.id}>
            {/* Outcome listener on the WHOLE card — see CoinTapReporter for
              why covering only the pill's component would bias the arms. */}
            <CoinTapReporter>
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
                The change comes with it as a prop. */}
                <CoinPriceRow
                  symbol={coin.symbol}
                  priceDecimals={coin.price_decimals}
                  changePct24H={coin.price_change_percentage_24h}
                  changePillVariant={pillVariant}
                />
              </Link>
            </CoinTapReporter>
          </li>
        ))}
      </ul>
    </>
  );
}
