import { config } from './index.js';

export const storageConfig = {
  bucket: config.aws.s3Bucket,
  region: config.aws.region,

  presignedUrl: {
    uploadExpiry: 15 * 60, // 15 minutes in seconds
    downloadExpiry: 60 * 60, // 1 hour in seconds
  },

  limits: {
    referenceImage: {
      maxSizeBytes: 10 * 1024 * 1024, // 10 MB
      allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
      allowedExtensions: ['.jpg', '.jpeg', '.png', '.webp'],
    },
    generatedImage: {
      maxSizeBytes: 20 * 1024 * 1024, // 20 MB
    },
  },

  thumbnails: {
    width: 400,
    height: 225,
    format: 'webp' as const,
    quality: 80,
  },
};
