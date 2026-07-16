import { describe, it, expect } from 'vitest';
import knex from 'knex';
import type { Knex } from 'knex';
import {
  softDelete,
  restore,
  addActiveFilter,
  permanentDelete,
} from '../../../src/utils/softDelete.js';

// A chainable recording stub standing in for a Knex instance. Records the
// (method, args) sequence so we can assert what each helper builds without a
// live database.
function makeDbMock() {
  const calls: Array<[string, unknown[]]> = [];
  const builder: Record<string, (...a: unknown[]) => unknown> = {
    where: (...a) => (calls.push(['where', a]), builder),
    whereNotNull: (...a) => (calls.push(['whereNotNull', a]), builder),
    update: (...a) => (calls.push(['update', a]), Promise.resolve(1)),
    delete: (...a) => (calls.push(['delete', a]), Promise.resolve(3)),
  };
  const db = ((table: string) => {
    calls.push(['table', [table]]);
    return builder;
  }) as unknown as Knex & { calls: typeof calls };
  (db as unknown as { fn: unknown }).fn = { now: () => 'CURRENT_TIMESTAMP' };
  db.calls = calls;
  return db;
}

describe('softDelete', () => {
  it('sets deleted_at to now() for the given id', async () => {
    const db = makeDbMock();
    await softDelete(db, 'acts', 'act-1');
    expect(db.calls).toContainEqual(['table', ['acts']]);
    expect(db.calls).toContainEqual(['where', [{ id: 'act-1' }]]);
    expect(db.calls).toContainEqual(['update', [{ deleted_at: 'CURRENT_TIMESTAMP' }]]);
  });
});

describe('restore', () => {
  it('clears deleted_at back to null', async () => {
    const db = makeDbMock();
    await restore(db, 'scenes', 'scene-1');
    expect(db.calls).toContainEqual(['where', [{ id: 'scene-1' }]]);
    expect(db.calls).toContainEqual(['update', [{ deleted_at: null }]]);
  });
});

describe('permanentDelete', () => {
  it('deletes only rows soft-deleted before the cutoff', async () => {
    const db = makeDbMock();
    const count = await permanentDelete(db, 'projects', 30);
    expect(count).toBe(3);
    expect(db.calls).toContainEqual(['whereNotNull', ['deleted_at']]);
    const whereCall = db.calls.find(
      ([m, a]) => m === 'where' && a[0] === 'deleted_at'
    );
    expect(whereCall).toBeDefined();
    expect(whereCall?.[1][1]).toBe('<'); // operator
    expect(whereCall?.[1][2]).toBeInstanceOf(Date); // cutoff
  });
});

describe('addActiveFilter', () => {
  it('appends a `deleted_at is null` predicate to the query', () => {
    // Build a real (connectionless) query and inspect its SQL.
    const qb = knex({ client: 'mysql2' });
    const sql = addActiveFilter(qb('acts').select('*')).toSQL().sql;
    expect(sql.toLowerCase()).toContain('`deleted_at` is null');
  });
});
