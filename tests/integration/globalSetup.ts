import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import knex from 'knex';
import { MySqlContainer, type StartedMySqlContainer } from '@testcontainers/mysql';

// One MySQL container for the whole integration run. We start it, apply every
// migration against it, and publish the connection URI two ways: on
// process.env (inherited by the forked worker) and to a temp file that
// tests/integration/setup.ts reads (belt-and-suspenders in case the pool
// worker was spawned before this env mutation).
export const DB_URL_FILE = path.join(os.tmpdir(), 'atelier-itest-db-url');

let container: StartedMySqlContainer;

export async function setup(): Promise<void> {
  container = await new MySqlContainer('mysql:8.0')
    .withDatabase('atelier_test')
    .withUsername('atelier')
    .withUserPassword('localpassword')
    .start();

  const url = container.getConnectionUri();
  process.env.DATABASE_URL = url;
  fs.writeFileSync(DB_URL_FILE, url);

  // Apply migrations by importing each migration module directly (vitest
  // transforms the .ts files), so we don't depend on knex's file loader
  // resolving TypeScript under the test runner.
  const migrator = knex({ client: 'mysql2', connection: url });
  try {
    // vitest runs with cwd at the project root.
    const migrationsDir = path.resolve(process.cwd(), 'src/db/migrations');
    const files = fs
      .readdirSync(migrationsDir)
      .filter((f) => f.endsWith('.ts'))
      .sort();

    for (const file of files) {
      const mod = await import(path.join(migrationsDir, file));
      await mod.up(migrator);
    }
  } finally {
    await migrator.destroy();
  }
}

export async function teardown(): Promise<void> {
  try {
    fs.rmSync(DB_URL_FILE, { force: true });
  } catch {
    // ignore
  }
  if (container) await container.stop();
}
