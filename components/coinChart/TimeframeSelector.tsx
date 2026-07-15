import { TIMEFRAMES } from '@/lib/timeframes';
import styles from './TimeframeSelector.module.css';

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
