import { defineConfig } from 'vitest/config';
import path from 'node:path';

// Unit test config. Fast, no I/O — every module under `include` is exercised
// purely (no DB, no network). The coverage gate therefore scopes to the
// high-priority pure modules the unit suite fully covers; DB-bound code
// (repositories, routes, authService's persistence paths) is covered by the
// integration suite (vitest.integration.config.ts), not this gate.
export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/unit/**/*.test.ts'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: [
        'src/services/encryption/**',
        'src/services/promptCompiler/PromptCompiler.ts',
        'src/services/promptCompiler/geminiAdapter.ts',
        'src/middleware/validate.ts',
        'src/middleware/authenticate.ts',
        'src/utils/sequencing.ts',
        'src/utils/softDelete.ts',
      ],
      thresholds: {
        statements: 70,
        branches: 60,
        functions: 70,
        lines: 70,
      },
    },
  },
});
