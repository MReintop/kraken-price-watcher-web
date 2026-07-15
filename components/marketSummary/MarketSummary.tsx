import { getCoins } from '@/lib/coins';
import { formatSignedPct } from '@/lib/candleChart';
import styles from './MarketSummary.module.css';

export default async function MarketSummary() {
  const coins = await getCoins();

  const totalCap = coins.reduce((sum, c) => sum + c.market_cap, 0);
  const avgChange =
    coins.reduce((sum, c) => sum + c.price_change_percentage_24h, 0) /
    coins.length;
  const up = avgChange >= 0;

  return (
    <section className={styles.summary}>
      <span>{coins.length} coins</span>

      <span>Total cap ${totalCap.toLocaleString()}</span>

      <span className={up ? styles.up : styles.down}>
        Avg 24h {formatSignedPct(avgChange)}
      </span>
    </section>
  );
}
