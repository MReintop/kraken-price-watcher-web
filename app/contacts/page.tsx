import styles from '../page.module.css';

export default function ContactsPage() {
  return (
    <main className={styles.main}>
      <h1 className={styles.title}>Contacts</h1>
      <p style={{ color: '#8a94a6', lineHeight: 1.7 }}>
        A plain static route — no data fetching, no dynamic <code>[id]</code>{' '}
        segment. It exists purely because there is a{' '}
        <code>app/contacts/page.tsx</code> file. Compare its URL (
        <code>/contacts</code>) to the home page (<code>app/page.tsx</code> →{' '}
        <code>/</code>).
      </p>
      <p style={{ color: '#8a94a6', lineHeight: 1.7 }}>
        support@example.com · @krakenwatch
      </p>
    </main>
  );
}
