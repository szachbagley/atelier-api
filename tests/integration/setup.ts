import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs';
import { beforeEach } from 'vitest';
import type { Knex } from 'knex';

// Publish the container DATABASE_URL into this worker BEFORE any src module is
// imported. globalSetup wrote it to this temp file (and to process.env, which
// the fork usually inherits — the file is the reliable fallback). We must set
// the env here at top-level, and only import the app's db lazily, because a
// static `import { db }` would evaluate config before this runs.
const DB_URL_FILE = path.join(os.tmpdir(), 'atelier-itest-db-url');
if (fs.existsSync(DB_URL_FILE)) {
  process.env.DATABASE_URL = fs.readFileSync(DB_URL_FILE, 'utf8').trim();
}
process.env.NODE_ENV = 'test';
process.env.JWT_ACCESS_SECRET ||= 'test-access-secret-minimum-32-characters-long';
process.env.JWT_REFRESH_SECRET ||= 'test-refresh-secret-minimum-32-characters-long';
process.env.ENCRYPTION_KEY ||=
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.S3_BUCKET ||= 'test-bucket';
process.env.BCRYPT_ROUNDS ||= '4';

let dbRef: Knex | undefined;

export async function getDb(): Promise<Knex> {
  if (!dbRef) {
    ({ db: dbRef } = await import('../../src/db/index.js'));
  }
  return dbRef;
}

// Empty every table (except knex bookkeeping) between tests so cases are
// independent regardless of order.
export async function truncateTables(): Promise<void> {
  const db = await getDb();
  const result = await db.raw(
    'SELECT table_name AS t FROM information_schema.tables WHERE table_schema = DATABASE()'
  );
  const rows = (result[0] as Array<{ t: string }>) ?? [];
  const tables = rows
    .map((r) => r.t)
    .filter((t) => !t.startsWith('knex_migrations'));

  await db.raw('SET FOREIGN_KEY_CHECKS = 0');
  for (const table of tables) {
    await db.raw(`TRUNCATE TABLE \`${table}\``);
  }
  await db.raw('SET FOREIGN_KEY_CHECKS = 1');
}

beforeEach(async () => {
  await truncateTables();
});
