import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';
import prettier from 'eslint-config-prettier';

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Last: turns off every eslint rule that would fight prettier over formatting.
  // eslint judges correctness, prettier judges layout — no overlap.
  prettier,
  {
    // No React here. Playwright's fixture callback is named `use`, which the
    // hook rules mistake for React's `use`.
    files: ['e2e/**'],
    rules: { 'react-hooks/rules-of-hooks': 'off' },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    '.next/**',
    '.next-e2e/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    // Generated output — not source.
    'coverage/**',
    'playwright-report/**',
    'test-results/**',
  ]),
]);

export default eslintConfig;
