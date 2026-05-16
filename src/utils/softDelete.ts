import type { Knex } from 'knex';

export async function softDelete(
  db: Knex,
  table: string,
  id: string
): Promise<void> {
  await db(table).where({ id }).update({ deleted_at: db.fn.now() });
}

export async function restore(
  db: Knex,
  table: string,
  id: string
): Promise<void> {
  await db(table).where({ id }).update({ deleted_at: null });
}

export function addActiveFilter<TRecord extends object, TResult>(
  query: Knex.QueryBuilder<TRecord, TResult>
): Knex.QueryBuilder<TRecord, TResult> {
  return query.whereNull('deleted_at');
}

export async function permanentDelete(
  db: Knex,
  table: string,
  olderThanDays: number
): Promise<number> {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - olderThanDays);

  return db(table)
    .whereNotNull('deleted_at')
    .where('deleted_at', '<', cutoff)
    .delete();
}
