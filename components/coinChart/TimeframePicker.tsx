import { TIMEFRAMES } from '@/lib/timeframes';
import styles from './TimeframePicker.module.css';

interface TimeframePickerProps {
  value: number;
  onChange: (days: number) => void;
}

export default function TimeframePicker({
  value,
  onChange,
}: TimeframePickerProps) {
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
