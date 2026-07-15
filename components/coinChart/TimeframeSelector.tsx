import styles from './TimeframeSelector.module.css';

export const TIMEFRAMES = [
  { label: '24H', days: 1 },
  { label: '1M', days: 30 },
  { label: '1Y', days: 365 },
] as const;

export default function TimeframeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (days: number) => void;
}) {
  return (
    <div className={styles.row}>
      {TIMEFRAMES.map((tf) => {
        const selected = tf.days === value;
        return (
          <button
            key={tf.days}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(tf.days)}
            className={selected ? styles.chipSelected : styles.chip}
          >
            {tf.label}
          </button>
        );
      })}
    </div>
  );
}
