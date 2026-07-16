import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Integration test config. Spins up a real MySQL via Testcontainers
// (tests/integration/globalSetup.ts starts one container for the whole run and
// applies migrations), then drives the Express app over HTTP with supertest.
// Runs serially in a single fork so tests share the one database without
// racing on truncation between cases.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/integration/**/*.test.ts'],
    globalSetup: ['tests/integration/globalSetup.ts'],
    setupFiles: ['tests/integration/setup.ts'],
    testTimeout: 30000,
    hookTimeout: 30000,
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
});
