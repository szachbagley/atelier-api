import knex from 'knex';
import knexConfig from './knexfile.js';
import { logger } from '../utils/logger.js';

export const db = knex(knexConfig);

export async function testConnection(): Promise<void> {
  try {
    await db.raw('SELECT 1');
    logger.info('Database connected');
  } catch (err) {
    logger.fatal({ err }, 'Database connection failed');
    process.exit(1);
  }
}
