import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { ArtStyle } from '../../types/models.js';
import { toCamelRow, toSnakeRow } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';

export interface ArtStyleRecord {
  id: string;
  projectId: string;
  name: string | null;
  description: string | null;
  colorPalette: string | null;
  styleReferences: string | null;
  technicalTerms: string[] | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// One art style per project (unique project_id). The row is created with the
// project; get returns it, upsert updates it (or re-creates it if it was
// somehow lost — e.g. soft-deleted by a bug — keeping PUT idempotent).

export async function get(projectId: string): Promise<ArtStyleRecord | null> {
  const row = await addActiveFilter(
    db<ArtStyle>('art_styles').where({ project_id: projectId })
  ).first();
  return row ? toCamelRow<ArtStyleRecord>(row) : null;
}

export async function upsert(
  projectId: string,
  data: object
): Promise<ArtStyleRecord> {
  const values = toSnakeRow(data);

  // technical_terms is a JSON column; serialize arrays for mysql2.
  if (Array.isArray(values.technical_terms)) {
    values.technical_terms = JSON.stringify(values.technical_terms);
  }

  const existing = await db<ArtStyle>('art_styles')
    .where({ project_id: projectId })
    .first();

  if (existing) {
    await db('art_styles')
      .where({ id: existing.id })
      .update({ ...values, deleted_at: null, updated_at: db.fn.now() });
  } else {
    await db('art_styles').insert({
      id: uuid(),
      project_id: projectId,
      ...values,
    });
  }

  return (await get(projectId)) as ArtStyleRecord;
}
