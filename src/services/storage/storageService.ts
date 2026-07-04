import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'node:path';
import sharp from 'sharp';
import { storageConfig } from '../../config/storage.js';
import { s3Client } from './s3Client.js';

// --- S3 key layout ---
// projects/{projectId}/references/{imageId}{ext}
// projects/{projectId}/generated/{imageId}.png
// projects/{projectId}/thumbnails/{imageId}_thumb.webp

export function getReferenceImageKey(
  projectId: string,
  imageId: string,
  ext: string
): string {
  return `projects/${projectId}/references/${imageId}${ext}`;
}

export function getGeneratedImageKey(
  projectId: string,
  imageId: string,
  format = 'png'
): string {
  return `projects/${projectId}/generated/${imageId}.${format}`;
}

// Derive the thumbnail key from any image key: same project prefix, the
// thumbnails/ category, and the image id with a _thumb suffix.
export function getThumbnailKey(imageS3Key: string): string {
  const dir = path.dirname(path.dirname(imageS3Key)); // projects/{projectId}
  const imageId = path.parse(imageS3Key).name;
  return `${dir}/thumbnails/${imageId}_thumb.${storageConfig.thumbnails.format}`;
}

// --- Presigning ---

export async function generatePresignedUploadUrl(
  key: string,
  contentType: string,
  expiresIn: number = storageConfig.presignedUrl.uploadExpiry
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function generatePresignedDownloadUrl(
  key: string,
  expiresIn: number = storageConfig.presignedUrl.downloadExpiry
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: storageConfig.bucket,
    Key: key,
  });
  return getSignedUrl(s3Client, command, { expiresIn });
}

export async function getImageUrl(s3Key: string): Promise<string> {
  return generatePresignedDownloadUrl(s3Key);
}

export async function getThumbnailUrl(imageS3Key: string): Promise<string> {
  return generatePresignedDownloadUrl(getThumbnailKey(imageS3Key));
}

// --- Object operations ---

export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3Client.send(
      new HeadObjectCommand({ Bucket: storageConfig.bucket, Key: key })
    );
    return true;
  } catch {
    return false;
  }
}

export async function uploadObject(
  key: string,
  body: Buffer,
  contentType: string
): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: storageConfig.bucket,
      Key: key,
      Body: body,
      ContentType: contentType,
    })
  );
}

export async function downloadObject(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: storageConfig.bucket, Key: key })
  );
  const bytes = await response.Body?.transformToByteArray();
  return Buffer.from(bytes ?? []);
}

export async function deleteObject(key: string): Promise<void> {
  await s3Client.send(
    new DeleteObjectCommand({ Bucket: storageConfig.bucket, Key: key })
  );
}

// Resize to the configured thumbnail spec and upload alongside the original.
export async function generateThumbnail(
  imageBuffer: Buffer,
  imageS3Key: string
): Promise<string> {
  const { width, height, format, quality } = storageConfig.thumbnails;

  const thumbnailBuffer = await sharp(imageBuffer)
    .resize(width, height, { fit: 'cover' })
    .toFormat(format, { quality })
    .toBuffer();

  const thumbnailKey = getThumbnailKey(imageS3Key);
  await uploadObject(thumbnailKey, thumbnailBuffer, `image/${format}`);
  return thumbnailKey;
}
