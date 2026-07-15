import nextJest from 'next/jest.js';

// Transforms TS/JSX via SWC, stubs CSS modules, loads next.config and .env.
const createJestConfig = nextJest({ dir: './' });

/** @type {import('jest').Config} */
const config = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  // Playwright specs match Jest's default *.spec.ts pattern; without this they
  // are collected here and fail importing @playwright/test.
  testPathIgnorePatterns: ['<rootDir>/e2e/', '<rootDir>/.next/'],
  // Mirrors the tsconfig "@/*" alias.
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  // More reliable than babel-istanbul under the SWC transform.
  coverageProvider: 'v8',
  coverageDirectory: '<rootDir>/coverage',
  // Every source file, so untested ones surface at 0% rather than being absent.
  // Excluded below: what Jest cannot render, which is covered in e2e/ instead.
  collectCoverageFrom: [
    'app/**/*.{ts,tsx}',
    'components/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    'store/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    // async Server Components: RTL cannot render them.
    '!app/layout.tsx',
    '!app/coins/**',
    '!components/markets/Markets.tsx',
    '!components/marketSummary/MarketSummary.tsx',
    // Sync, but renders async children.
    '!app/page.tsx',
    // Route handlers, not components.
    '!app/api/**',
    // Error boundaries: Next owns when they mount, and global-error.tsx renders
    // its own <html>. The UI they share is components/errorState, which Jest
    // does see; these two only wire it to Next's error API.
    '!app/error.tsx',
    '!app/global-error.tsx',
  ],
};

export default createJestConfig(config);
