import type { Knex } from 'knex';

export const SEQUENCE_GAP = 1000;

export async function getNextSequenceNumber(
  db: Knex,
  table: string,
  parentColumn: string,
  parentId: string
): Promise<number> {
  const result = await db(table)
    .where({ [parentColumn]: parentId })
    .whereNull('deleted_at')
    .max<{ max: number | null }>({ max: 'sequence_number' })
    .first();

  const currentMax = result?.max ?? 0;
  return currentMax + SEQUENCE_GAP;
}

export function renumber<T extends { sequence_number: number }>(items: T[]): T[] {
  return items.map((item, index) => ({
    ...item,
    sequence_number: (index + 1) * SEQUENCE_GAP,
  }));
}

export function getInsertBetweenSequence(
  before: number | null,
  after: number | null
): number {
  if (before === null && after === null) {
    return SEQUENCE_GAP;
  }
  if (before === null) {
    return Math.floor((after as number) / 2);
  }
  if (after === null) {
    return before + SEQUENCE_GAP;
  }
  return Math.floor((before + after) / 2);
}
