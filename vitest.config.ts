import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 10_000,
    // Include all test types except e2e (Playwright handles those)
    include: [
      'src/tests/unit/**/*.test.ts',
      'src/tests/integration/**/*.test.ts',
      'src/tests/smoke/**/*.test.ts',
    ],
    exclude: [
      'src/tests/e2e/**',
      'node_modules/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: [
        'src/tests/**',
        'src/**/*.d.ts',
        'src/app/api/admin/debug/**',   // dev-only endpoint
        'src/app/api/admin/fix-seed/**', // dev-only endpoint
      ],
      thresholds: {
        lines:      70,
        functions:  70,
        branches:   60,
        statements: 70,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
