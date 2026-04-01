import type { Knex } from 'knex';
import { config } from '../config/index.js';

const baseConfig: Knex.Config = {
  client: 'mysql2',
  connection: config.database.url,
  pool: {
    min: 0,
    max: 10,
  },
  migrations: {
    tableName: 'knex_migrations',
    directory: './migrations',
    extension: 'ts',
  },
};

const knexConfig: Record<string, Knex.Config> = {
  development: {
    ...baseConfig,
  },
  test: {
    ...baseConfig,
  },
  production: {
    ...baseConfig,
    pool: {
      min: 2,
      max: 10,
    },
  },
};

export default knexConfig[config.env] || knexConfig.development;
