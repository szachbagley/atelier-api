import { db } from '../index.js';
import type { Setting, TimeOfDay, Weather } from '../../types/models.js';
import { toCamelRow } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';
import { makeProjectScopedCrud } from './componentCrud.js';

export interface SettingRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  setDressing: string | null;
  timeOfDay: TimeOfDay;
  weather: Weather;
  lighting: string | null;
  mood: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface SettingListItem extends SettingRecord {
  referenceImageCount: number;
}

export const { findById, create, update, remove } =
  makeProjectScopedCrud<SettingRecord>('settings');

const REF_IMAGE_COUNT_SQL = `(
  select count(*) from reference_images ri
  where ri.component_type = 'setting'
    and ri.component_id = settings.id
    and ri.deleted_at is null
) as reference_image_count`;

export async function list(projectId: string): Promise<SettingListItem[]> {
  const rows = await addActiveFilter(
    db<Setting>('settings').where({ project_id: projectId })
  )
    .select('settings.*', db.raw(REF_IMAGE_COUNT_SQL))
    .orderBy('created_at');

  return rows.map((row) => {
    const item = toCamelRow<SettingListItem>(row as object);
    item.referenceImageCount = Number(item.referenceImageCount);
    return item;
  });
}
