'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Footer.module.css';

const links = [
  { href: '/', label: 'Markets' },
  { href: '/contacts', label: 'Contacts' },
];

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className={styles.footer}>
      {links.map((link) => (
        <Link
          key={link.href}
          href={link.href}
          className={pathname === link.href ? styles.active : styles.link}
        >
          {link.label}
        </Link>
      ))}
    </footer>
  );
}
