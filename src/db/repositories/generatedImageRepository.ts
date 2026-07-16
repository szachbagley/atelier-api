import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { GeneratedImage } from '../../types/models.js';
import * as storage from '../../services/storage/storageService.js';
import { toCamelRow } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';

export interface GeneratedImageRecord {
  id: string;
  projectId: string;
  s3Key: string;
  prompt: string | null;
  provider: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
  createdAt: Date;
  url?: string;
  thumbnailUrl?: string;
}

export interface CreateGeneratedImageData {
  s3Key: string;
  prompt: string;
  provider: string;
  model: string;
  width?: number | null;
  height?: number | null;
}

export async function create(
  projectId: string,
  data: CreateGeneratedImageData
): Promise<string> {
  const id = uuid();
  await db('generated_images').insert({
    id,
    project_id: projectId,
    s3_key: data.s3Key,
    prompt: data.prompt,
    provider: data.provider,
    model: data.model,
    width: data.width ?? null,
    height: data.height ?? null,
  });
  return id;
}

export async function findById(
  id: string
): Promise<GeneratedImageRecord | null> {
  const row = await addActiveFilter(
    db<GeneratedImage>('generated_images').where({ id })
  ).first();
  if (!row) return null;

  const record = toCamelRow<GeneratedImageRecord>(row);
  record.url = await storage.getImageUrl(row.s3_key);
  record.thumbnailUrl = await storage.getThumbnailUrl(row.s3_key);
  return record;
}

export async function findByProject(
  projectId: string
): Promise<GeneratedImageRecord[]> {
  const rows = await addActiveFilter(
    db<GeneratedImage>('generated_images').where({ project_id: projectId })
  ).orderBy('created_at', 'desc');

  return Promise.all(
    rows.map(async (row) => {
      const record = toCamelRow<GeneratedImageRecord>(row);
      record.url = await storage.getImageUrl(row.s3_key);
      record.thumbnailUrl = await storage.getThumbnailUrl(row.s3_key);
      return record;
    })
  );
}
