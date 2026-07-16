'use client';

import { useAppSelector } from '@/store/hooks';
import { selectSocketStatus } from '@/store/pricesSlice';
import { STATUS_LABEL } from '@/lib/feedStatus';
import styles from './FeedStatus.module.css';

// Said once for the whole list rather than per row: the socket's state is the
// same for every card, and eight cards repeating it says nothing extra. What is
// per-symbol stays on the row.
export default function FeedStatus() {
  const status = useAppSelector(selectSocketStatus);

  // Mounted even when there is nothing to say: a live region added to the DOM
  // at the same moment as its text is not reliably announced.
  return (
    <p className={styles.banner} role="status">
      {status !== 'live' && (
        <>
          <span className={styles.dot} />
          {STATUS_LABEL[status]}
        </>
      )}
    </p>
  );
}
