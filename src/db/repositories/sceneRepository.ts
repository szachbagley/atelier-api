import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { Scene } from '../../types/models.js';
import { toCamelRow, toSnakeRow } from '../../utils/caseMapping.js';
import { getNextSequenceNumber, SEQUENCE_GAP } from '../../utils/sequencing.js';
import { addActiveFilter, softDelete } from '../../utils/softDelete.js';

export interface SceneRecord {
  id: string;
  actId: string;
  title: string;
  sequenceNumber: number;
  defaultSettingId: string | null;
  defaultLightingId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SceneListItem {
  id: string;
  title: string;
  sequenceNumber: number;
  defaultSetting: { id: string; name: string } | null;
  defaultLighting: { id: string; name: string } | null;
  shotCount: number;
}

export interface UpdateSceneData {
  title?: string;
  defaultSettingId?: string | null;
  defaultLightingId?: string | null;
}

const SHOT_COUNT_SQL = `(
  select count(*) from shots s
  where s.scene_id = scenes.id and s.deleted_at is null
) as shot_count`;

export async function listByAct(actId: string): Promise<SceneListItem[]> {
  // addActiveFilter would add an unqualified deleted_at, ambiguous across the
  // joined tables — qualify it explicitly here.
  const rows = await db<Scene>('scenes')
    .where({ 'scenes.act_id': actId })
    .whereNull('scenes.deleted_at')
    .leftJoin('settings', 'scenes.default_setting_id', 'settings.id')
    .leftJoin(
      'lighting_setups',
      'scenes.default_lighting_id',
      'lighting_setups.id'
    )
    .select(
      'scenes.*',
      'settings.name as setting_name',
      'lighting_setups.name as lighting_name',
      db.raw(SHOT_COUNT_SQL)
    )
    .orderBy('scenes.sequence_number');

  return (
    rows as Array<
      Scene & {
        setting_name: string | null;
        lighting_name: string | null;
        shot_count: number | string;
      }
    >
  ).map((row) => ({
    id: row.id,
    title: row.title,
    sequenceNumber: row.sequence_number,
    defaultSetting: row.default_setting_id
      ? { id: row.default_setting_id, name: row.setting_name as string }
      : null,
    defaultLighting: row.default_lighting_id
      ? { id: row.default_lighting_id, name: row.lighting_name as string }
      : null,
    shotCount: Number(row.shot_count),
  }));
}

// Look up a scene while verifying it belongs to the project through an
// active act (the "cascade" of a soft-deleted act is enforced here).
export async function findInProject(
  projectId: string,
  sceneId: string
): Promise<SceneRecord | null> {
  const row = await db<Scene>('scenes')
    .join('acts', 'scenes.act_id', 'acts.id')
    .where({
      'scenes.id': sceneId,
      'acts.project_id': projectId,
    })
    .whereNull('scenes.deleted_at')
    .whereNull('acts.deleted_at')
    .select('scenes.*')
    .first();

  return row ? toCamelRow<SceneRecord>(row) : null;
}

export async function create(
  actId: string,
  data: {
    title: string;
    defaultSettingId?: string | null;
    defaultLightingId?: string | null;
  }
): Promise<SceneRecord> {
  const id = uuid();
  const sequenceNumber = await getNextSequenceNumber(
    db,
    'scenes',
    'act_id',
    actId
  );

  await db('scenes').insert({
    id,
    act_id: actId,
    sequence_number: sequenceNumber,
    ...toSnakeRow(data),
  });

  const row = (await db<Scene>('scenes').where({ id }).first()) as Scene;
  return toCamelRow<SceneRecord>(row);
}

export async function update(
  id: string,
  data: UpdateSceneData
): Promise<SceneRecord> {
  await db('scenes')
    .where({ id })
    .update({ ...toSnakeRow(data), updated_at: db.fn.now() });
  const row = (await db<Scene>('scenes').where({ id }).first()) as Scene;
  return toCamelRow<SceneRecord>(row);
}

export async function remove(id: string): Promise<void> {
  await softDelete(db, 'scenes', id);
}

export async function reorder(
  actId: string,
  orderedIds: string[]
): Promise<number | null> {
  const existing = await addActiveFilter(
    db<Scene>('scenes').where({ act_id: actId })
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
      await trx('scenes')
        .where({ id })
        .update({
          sequence_number: (index + 1) * SEQUENCE_GAP,
          updated_at: trx.fn.now(),
        });
    }
  });

  return orderedIds.length;
}

// Move to another act, appended at the end of the target's sequence.
export async function move(
  sceneId: string,
  targetActId: string
): Promise<SceneRecord> {
  const sequenceNumber = await getNextSequenceNumber(
    db,
    'scenes',
    'act_id',
    targetActId
  );

  await db('scenes').where({ id: sceneId }).update({
    act_id: targetActId,
    sequence_number: sequenceNumber,
    updated_at: db.fn.now(),
  });

  const row = (await db<Scene>('scenes')
    .where({ id: sceneId })
    .first()) as Scene;
  return toCamelRow<SceneRecord>(row);
}
