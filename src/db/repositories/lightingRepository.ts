import { db } from '../index.js';
import type { LightingSetup } from '../../types/models.js';
import { toCamelRows } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';
import { makeProjectScopedCrud } from './componentCrud.js';

export interface LightingRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  mood: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const { findById, create, update, remove } =
  makeProjectScopedCrud<LightingRecord>('lighting_setups');

export async function list(projectId: string): Promise<LightingRecord[]> {
  const rows = await addActiveFilter(
    db<LightingSetup>('lighting_setups').where({ project_id: projectId })
  ).orderBy('created_at');
  return toCamelRows<LightingRecord>(rows);
}
