import knex, { Knex } from 'knex';
import dotenv from 'dotenv';

dotenv.config();

const knexConfig: Record<string, Knex.Config> = {
  development: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'healthguard',
      user: process.env.DB_USER || 'healthguard_user',
      password: process.env.DB_PASSWORD || '',
      ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
    },
    migrations: {
      directory: '../migrations',
      extension: 'sql',
    },
    seeds: {
      directory: '../seeds',
    },
  },

  production: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      ssl: { rejectUnauthorized: true },
    },
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
      acquireTimeoutMillis: 30000,
      idleTimeoutMillis: 600000,
    },
    migrations: {
      directory: '../migrations',
      extension: 'sql',
    },
    seeds: {
      directory: '../seeds',
    },
  },

  test: {
    client: 'pg',
    connection: {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'healthguard_test',
      user: process.env.DB_USER || 'healthguard_user',
      password: process.env.DB_PASSWORD || '',
      ssl: false,
    },
    pool: {
      min: 1,
      max: 5,
    },
    migrations: {
      directory: '../migrations',
      extension: 'sql',
    },
    seeds: {
      directory: '../seeds',
    },
  },
};

const environment = process.env.NODE_ENV || 'development';
const config = knexConfig[environment] || knexConfig.development;

const db: Knex = knex(config);

export { knexConfig, db };
export default db;
