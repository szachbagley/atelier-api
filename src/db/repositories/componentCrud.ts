import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import { toCamelRow, toSnakeRow } from '../../utils/caseMapping.js';
import { addActiveFilter, softDelete } from '../../utils/softDelete.js';

// Shared CRUD core for project-scoped component tables (characters, settings,
// props, lighting_setups). Component repositories build on this and add their
// table-specific list aggregates. All output is camelCase; all reads filter
// soft-deleted rows.
export interface ProjectScopedCrud<T extends object> {
  findById(projectId: string, id: string): Promise<T | null>;
  create(projectId: string, data: object): Promise<T>;
  update(id: string, data: object): Promise<T>;
  remove(id: string): Promise<void>;
}

export function makeProjectScopedCrud<T extends object>(
  table: string
): ProjectScopedCrud<T> {
  return {
    async findById(projectId, id) {
      const row = await addActiveFilter(
        db(table).where({ id, project_id: projectId })
      ).first();
      return row ? toCamelRow<T>(row) : null;
    },

    async create(projectId, data) {
      const id = uuid();
      await db(table).insert({
        id,
        project_id: projectId,
        ...toSnakeRow(data),
      });
      const row = await db(table).where({ id }).first();
      return toCamelRow<T>(row as object);
    },

    async update(id, data) {
      await db(table)
        .where({ id })
        .update({ ...toSnakeRow(data), updated_at: db.fn.now() });
      const row = await db(table).where({ id }).first();
      return toCamelRow<T>(row as object);
    },

    async remove(id) {
      await softDelete(db, table, id);
    },
  };
}
