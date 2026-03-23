import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 15_000,
    hookTimeout: 10_000,
    include: [
      'src/tests/unit/**/*.test.ts',
      'src/tests/integration/**/*.test.ts',
      'src/tests/smoke/**/*.test.ts',
    ],
    exclude: ['src/tests/e2e/**', 'node_modules/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      // Only measure coverage on core business logic - not UI components or pages
      include: [
        'src/lib/**/*.ts',
        'src/app/api/**/*.ts',
      ],
      exclude: [
        'src/lib/prisma.ts',        // just client init
        'src/app/api/admin/debug/**',
        'src/app/api/admin/fix-seed/**',
        'src/tests/**',
        '**/*.d.ts',
      ],
      thresholds: {
        // Realistic thresholds for API routes + lib (not UI)
        lines:      55,
        functions:  55,
        branches:   50,
        statements: 55,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
});
