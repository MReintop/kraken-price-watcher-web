import StoreProvider from '@/components/storeProvider/StoreProvider';
import { getCoins } from '@/lib/coins';

interface MarketsLayoutProps {
  children: React.ReactNode;
}

// Fetched here, not at the root: there, every route waited on CoinGecko and
// Kraken — including the 404, which the build marked as revalidating every 30s.
export default async function MarketsLayout({ children }: MarketsLayoutProps) {
  const coins = await getCoins();

  return <StoreProvider initialCoins={coins}>{children}</StoreProvider>;
}
