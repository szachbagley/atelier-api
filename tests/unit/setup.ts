import { beforeEach, vi } from 'vitest';

// Deterministic env for the config module (src/config/index.ts calls
// required(...) at import time). Set before any source module is imported —
// setupFiles run before the test files' module graphs are evaluated. dotenv
// does not override already-set vars, so these win over any local .env.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'mysql://test:test@127.0.0.1:3306/atelier_test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-minimum-32-characters-long';
process.env.ENCRYPTION_KEY ||=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.S3_BUCKET ||= 'test-bucket';
// Keep bcrypt cheap in unit tests that hash.
process.env.BCRYPT_ROUNDS ||= '4';

beforeEach(() => {
  vi.clearAllMocks();
});
