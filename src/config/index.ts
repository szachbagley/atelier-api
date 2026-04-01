import { config as dotenvConfig } from 'dotenv';

dotenvConfig();

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function optional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

export const config = {
  env: optional('NODE_ENV', 'development'),
  port: parseInt(optional('PORT', '3000'), 10),

  database: {
    url: required('DATABASE_URL'),
  },

  auth: {
    accessTokenSecret: required('JWT_ACCESS_SECRET'),
    refreshTokenSecret: required('JWT_REFRESH_SECRET'),
    accessTokenExpiry: optional('JWT_ACCESS_EXPIRY', '15m'),
    refreshTokenExpiry: optional('JWT_REFRESH_EXPIRY', '7d'),
    bcryptRounds: parseInt(optional('BCRYPT_ROUNDS', '12'), 10),
  },

  encryption: {
    key: required('ENCRYPTION_KEY'),
  },

  aws: {
    region: optional('AWS_REGION', 'us-west-2'),
    s3Bucket: required('S3_BUCKET'),
  },

  cors: {
    origins: optional('CORS_ORIGINS', 'http://localhost:5173').split(','),
  },
};
