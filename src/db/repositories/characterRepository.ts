import { db } from '../index.js';
import type { Character, ReferenceImage, Variant } from '../../types/models.js';
import { toCamelRow, toCamelRows } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';
import { makeProjectScopedCrud } from './componentCrud.js';

export interface CharacterRecord {
  id: string;
  projectId: string;
  name: string;
  physicalDescription: string | null;
  defaultAppearance: string | null;
  personality: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface CharacterListItem extends CharacterRecord {
  variantCount: number;
  referenceImageCount: number;
}

export interface VariantRecord {
  id: string;
  characterId: string;
  name: string;
  description: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReferenceImageRecord {
  id: string;
  filename: string | null;
  mimeType: string | null;
  uploadedAt: Date;
}

export interface CharacterDetail extends CharacterRecord {
  variants: VariantRecord[];
  referenceImages: ReferenceImageRecord[];
}

const crud = makeProjectScopedCrud<CharacterRecord>('characters');

export const { findById, create, update, remove } = crud;

const VARIANT_COUNT_SQL = `(
  select count(*) from variants v
  where v.character_id = characters.id and v.deleted_at is null
) as variant_count`;

const REF_IMAGE_COUNT_SQL = `(
  select count(*) from reference_images ri
  where ri.component_type = 'character'
    and ri.component_id = characters.id
    and ri.deleted_at is null
) as reference_image_count`;

export async function list(projectId: string): Promise<CharacterListItem[]> {
  const rows = await addActiveFilter(
    db<Character>('characters').where({ project_id: projectId })
  )
    .select(
      'characters.*',
      db.raw(VARIANT_COUNT_SQL),
      db.raw(REF_IMAGE_COUNT_SQL)
    )
    .orderBy('created_at');

  return rows.map((row) => {
    const item = toCamelRow<CharacterListItem>(row as object);
    item.variantCount = Number(item.variantCount);
    item.referenceImageCount = Number(item.referenceImageCount);
    return item;
  });
}

export async function findDetail(
  projectId: string,
  id: string
): Promise<CharacterDetail | null> {
  const character = await crud.findById(projectId, id);
  if (!character) return null;

  const variants = await addActiveFilter(
    db<Variant>('variants').where({ character_id: id })
  ).orderBy('created_at');

  const referenceImages = await addActiveFilter(
    db<ReferenceImage>('reference_images').where({
      component_type: 'character',
      component_id: id,
    })
  ).orderBy('uploaded_at');

  return {
    ...character,
    variants: toCamelRows<VariantRecord>(variants),
    referenceImages: referenceImages.map((img) => ({
      id: img.id,
      filename: img.filename,
      mimeType: img.mime_type,
      uploadedAt: img.uploaded_at,
    })),
  };
}
