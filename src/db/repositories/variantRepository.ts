import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { Variant } from '../../types/models.js';
import { toCamelRow, toCamelRows, toSnakeRow } from '../../utils/caseMapping.js';
import { addActiveFilter, softDelete } from '../../utils/softDelete.js';
import type { VariantRecord } from './characterRepository.js';

export type { VariantRecord };

// Variants are scoped to a character; routes must verify the character
// belongs to the project (via characterRepository.findById) before calling in.

export async function list(characterId: string): Promise<VariantRecord[]> {
  const rows = await addActiveFilter(
    db<Variant>('variants').where({ character_id: characterId })
  ).orderBy('created_at');
  return toCamelRows<VariantRecord>(rows);
}

export async function findById(
  characterId: string,
  id: string
): Promise<VariantRecord | null> {
  const row = await addActiveFilter(
    db<Variant>('variants').where({ id, character_id: characterId })
  ).first();
  return row ? toCamelRow<VariantRecord>(row) : null;
}

export async function create(
  characterId: string,
  data: object
): Promise<VariantRecord> {
  const id = uuid();
  await db('variants').insert({
    id,
    character_id: characterId,
    ...toSnakeRow(data),
  });
  const row = await db<Variant>('variants').where({ id }).first();
  return toCamelRow<VariantRecord>(row as Variant);
}

export async function update(
  id: string,
  data: object
): Promise<VariantRecord> {
  await db('variants')
    .where({ id })
    .update({ ...toSnakeRow(data), updated_at: db.fn.now() });
  const row = await db<Variant>('variants').where({ id }).first();
  return toCamelRow<VariantRecord>(row as Variant);
}

export async function remove(id: string): Promise<void> {
  await softDelete(db, 'variants', id);
}
