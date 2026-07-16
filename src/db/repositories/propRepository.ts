import { db } from '../index.js';
import type { Prop } from '../../types/models.js';
import { toCamelRows } from '../../utils/caseMapping.js';
import { addActiveFilter } from '../../utils/softDelete.js';
import { makeProjectScopedCrud } from './componentCrud.js';

export interface PropRecord {
  id: string;
  projectId: string;
  name: string;
  description: string | null;
  handledBy: string | null;
  aiDescription: string | null;
  createdAt: Date;
  updatedAt: Date;
}

export const { findById, create, update, remove } =
  makeProjectScopedCrud<PropRecord>('props');

export async function list(projectId: string): Promise<PropRecord[]> {
  const rows = await addActiveFilter(
    db<Prop>('props').where({ project_id: projectId })
  ).orderBy('created_at');
  return toCamelRows<PropRecord>(rows);
}
