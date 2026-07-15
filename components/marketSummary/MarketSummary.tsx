import { getCoins } from '@/lib/coins';
import { formatSignedPct } from '@/lib/format';
import styles from './MarketSummary.module.css';

export default async function MarketSummary() {
  const coins = await getCoins();

  const totalCap = coins.reduce((sum, c) => sum + c.market_cap, 0);

  // Averaged over the coins that have a figure, not over all of them: counting a
  // missing change as zero drags the average toward flat and calls it market
  // data. With none to average, there is no average to report.
  const changes = coins
    .map((coin) => coin.price_change_percentage_24h)
    .filter((change): change is number => change != null);
  const avgChange = changes.length
    ? changes.reduce((sum, change) => sum + change, 0) / changes.length
    : null;
  const up = avgChange != null && avgChange >= 0;

  return (
    <section className={styles.summary}>
      <span>{coins.length} coins</span>

      <span>Total cap ${totalCap.toLocaleString()}</span>

      <span className={up ? styles.up : styles.down}>
        Avg 24h {avgChange == null ? '—' : formatSignedPct(avgChange)}
      </span>
    </section>
  );
}
