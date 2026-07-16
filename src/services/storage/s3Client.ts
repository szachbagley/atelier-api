import { S3Client } from '@aws-sdk/client-s3';
import { storageConfig } from '../../config/storage.js';

// Credentials come from the AWS SDK default credential chain (env vars,
// shared config, or the ECS task role in production) — never from src/config.
export const s3Client = new S3Client({ region: storageConfig.region });
