import StoreProvider from '@/components/storeProvider/StoreProvider';
import { getCoins } from '@/lib/coins';

interface MarketsLayoutProps {
  children: React.ReactNode;
}

// The market data is fetched here rather than at the root because this is where
// it is used. At the root, every route waited on CoinGecko and Kraken to render
// — including a 404, which the build duly marked as revalidating every 30
// seconds. A page with no prices on it should not be able to fail because an
// exchange did.
export default async function MarketsLayout({ children }: MarketsLayoutProps) {
  const coins = await getCoins();

  return <StoreProvider initialCoins={coins}>{children}</StoreProvider>;
}
