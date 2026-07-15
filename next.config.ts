import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // The e2e suite builds to its own directory. `next dev` writes to .next
  // continuously, so sharing it means a dev server clobbers the production build
  // the suite just made, and `next start` finds no BUILD_ID.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
};

export default nextConfig;
