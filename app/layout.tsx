import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import Footer from '@/components/footer/Footer';
import StoreProvider from '@/components/storeProvider/StoreProvider';
import { getCoins } from '@/lib/coins';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Kraken Price Watcher',
  description: 'Live cryptocurrency prices, streamed from Kraken.',
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const coins = await getCoins();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable}`}>
      <body>
        <StoreProvider initialCoins={coins}>
          {children}
          <Footer />
        </StoreProvider>
        <Analytics />
      </body>
    </html>
  );
}
