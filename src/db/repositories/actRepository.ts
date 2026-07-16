import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { Act } from '../../types/models.js';
import { toCamelRow } from '../../utils/caseMapping.js';
import { getNextSequenceNumber, SEQUENCE_GAP } from '../../utils/sequencing.js';
import { addActiveFilter, softDelete } from '../../utils/softDelete.js';

export interface ActRecord {
  id: string;
  projectId: string;
  title: string;
  sequenceNumber: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ActListItem extends ActRecord {
  sceneCount: number;
}

const SCENE_COUNT_SQL = `(
  select count(*) from scenes sc
  where sc.act_id = acts.id and sc.deleted_at is null
) as scene_count`;

export async function list(projectId: string): Promise<ActListItem[]> {
  const rows = await addActiveFilter(
    db<Act>('acts').where({ project_id: projectId })
  )
    .select('acts.*', db.raw(SCENE_COUNT_SQL))
    .orderBy('sequence_number');

  return rows.map((row) => {
    const item = toCamelRow<ActListItem>(row as object);
    item.sceneCount = Number(item.sceneCount);
    return item;
  });
}

export async function findById(
  projectId: string,
  id: string
): Promise<ActRecord | null> {
  const row = await addActiveFilter(
    db<Act>('acts').where({ id, project_id: projectId })
  ).first();
  return row ? toCamelRow<ActRecord>(row) : null;
}

export async function create(
  projectId: string,
  title: string
): Promise<ActRecord> {
  const id = uuid();
  const sequenceNumber = await getNextSequenceNumber(
    db,
    'acts',
    'project_id',
    projectId
  );

  await db('acts').insert({
    id,
    project_id: projectId,
    title,
    sequence_number: sequenceNumber,
  });

  const row = (await db<Act>('acts').where({ id }).first()) as Act;
  return toCamelRow<ActRecord>(row);
}

export async function update(id: string, title: string): Promise<ActRecord> {
  await db('acts').where({ id }).update({ title, updated_at: db.fn.now() });
  const row = (await db<Act>('acts').where({ id }).first()) as Act;
  return toCamelRow<ActRecord>(row);
}

export async function remove(id: string): Promise<void> {
  // Scenes and shots under this act become unreachable through the API
  // (every read walks the act → scene → shot chain with active filters).
  await softDelete(db, 'acts', id);
}

// Reassigns sequence numbers to match orderedIds. Returns the number of acts
// updated, or null if orderedIds does not exactly match the project's active
// acts (caller maps that to a validation error).
export async function reorder(
  projectId: string,
  orderedIds: string[]
): Promise<number | null> {
  const existing = await addActiveFilter(
    db<Act>('acts').where({ project_id: projectId })
  ).select('id');
  const existingIds = new Set(existing.map((row) => row.id));

  if (
    existingIds.size !== orderedIds.length ||
    !orderedIds.every((id) => existingIds.has(id))
  ) {
    return null;
  }

  await db.transaction(async (trx) => {
    for (const [index, id] of orderedIds.entries()) {
      await trx('acts')
        .where({ id })
        .update({
          sequence_number: (index + 1) * SEQUENCE_GAP,
          updated_at: trx.fn.now(),
        });
    }
  });

  return orderedIds.length;
}
