import { v4 as uuid } from 'uuid';
import { db } from '../index.js';
import type { Project } from '../../types/models.js';
import { toCamelRow, toSnakeRow } from '../../utils/caseMapping.js';
import { addActiveFilter, restore, softDelete } from '../../utils/softDelete.js';

export interface ProjectSummary {
  id: string;
  title: string;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  actCount: number;
  shotCount: number;
}

export interface ProjectDetail extends ProjectSummary {
  shareToken: string | null;
  deletedAt: Date | null;
  sceneCount: number;
  characterCount: number;
}

export interface UpdateProjectData {
  title?: string;
}

// The camelCase shape of a projects row as it leaves the repository.
export interface ProjectRecord {
  id: string;
  userId: string;
  title: string;
  shareToken: string | null;
  isPublic: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
}

function toRecord(row: Project): ProjectRecord {
  const record = toCamelRow<ProjectRecord>(row);
  record.isPublic = Boolean(row.is_public); // tinyint(1) → boolean
  return record;
}

// Correlated subqueries keep the aggregates fan-out-free; every level of the
// acts → scenes → shots chain applies its own soft-delete filter.
const ACT_COUNT_SQL = `(
  select count(*) from acts a
  where a.project_id = projects.id and a.deleted_at is null
) as act_count`;

const SCENE_COUNT_SQL = `(
  select count(*) from scenes sc
  join acts a on sc.act_id = a.id
  where a.project_id = projects.id
    and sc.deleted_at is null and a.deleted_at is null
) as scene_count`;

const SHOT_COUNT_SQL = `(
  select count(*) from shots s
  join scenes sc on s.scene_id = sc.id
  join acts a on sc.act_id = a.id
  where a.project_id = projects.id
    and s.deleted_at is null and sc.deleted_at is null and a.deleted_at is null
) as shot_count`;

const CHARACTER_COUNT_SQL = `(
  select count(*) from characters c
  where c.project_id = projects.id and c.deleted_at is null
) as character_count`;

interface RawProjectRow extends Project {
  act_count: number | string;
  scene_count?: number | string;
  shot_count: number | string;
  character_count?: number | string;
}

function toSummary(row: RawProjectRow): ProjectSummary {
  return {
    id: row.id,
    title: row.title,
    isPublic: Boolean(row.is_public),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    actCount: Number(row.act_count),
    shotCount: Number(row.shot_count),
  };
}

function toDetail(row: RawProjectRow): ProjectDetail {
  return {
    ...toSummary(row),
    shareToken: row.share_token,
    deletedAt: row.deleted_at,
    sceneCount: Number(row.scene_count),
    characterCount: Number(row.character_count),
  };
}

export async function findByUserId(userId: string): Promise<ProjectSummary[]> {
  const rows = await addActiveFilter(
    db<Project>('projects').where({ user_id: userId })
  )
    .select('projects.*', db.raw(ACT_COUNT_SQL), db.raw(SHOT_COUNT_SQL))
    .orderBy('updated_at', 'desc');

  return (rows as RawProjectRow[]).map(toSummary);
}

export async function findById(id: string): Promise<ProjectDetail | null> {
  const row = await addActiveFilter(db<Project>('projects').where({ id }))
    .select(
      'projects.*',
      db.raw(ACT_COUNT_SQL),
      db.raw(SCENE_COUNT_SQL),
      db.raw(SHOT_COUNT_SQL),
      db.raw(CHARACTER_COUNT_SQL)
    )
    .first();

  return row ? toDetail(row as RawProjectRow) : null;
}

export async function create(
  userId: string,
  data: { title: string }
): Promise<ProjectRecord> {
  const projectId = uuid();

  // Every project owns exactly one art_styles row (empty until the user fills
  // it in); create both atomically.
  await db.transaction(async (trx) => {
    await trx('projects').insert({
      id: projectId,
      user_id: userId,
      title: data.title,
    });
    await trx('art_styles').insert({
      id: uuid(),
      project_id: projectId,
    });
  });

  const row = (await db<Project>('projects')
    .where({ id: projectId })
    .first()) as Project;
  return toRecord(row);
}

export async function update(
  id: string,
  data: UpdateProjectData
): Promise<ProjectRecord> {
  await db('projects')
    .where({ id })
    .update({ ...toSnakeRow(data), updated_at: db.fn.now() });

  const row = (await db<Project>('projects').where({ id }).first()) as Project;
  return toRecord(row);
}

export async function softDeleteProject(id: string): Promise<void> {
  await softDelete(db, 'projects', id);
}

export async function restoreProject(id: string): Promise<void> {
  await restore(db, 'projects', id);
}

export async function setShareToken(
  id: string
): Promise<{ shareToken: string }> {
  const shareToken = uuid();
  await db('projects').where({ id }).update({
    share_token: shareToken,
    is_public: true,
    updated_at: db.fn.now(),
  });
  return { shareToken };
}

export async function revokeShare(id: string): Promise<void> {
  await db('projects').where({ id }).update({
    share_token: null,
    is_public: false,
    updated_at: db.fn.now(),
  });
}

export async function findByShareToken(
  token: string
): Promise<ProjectRecord | null> {
  const row = await addActiveFilter(
    db<Project>('projects').where({ share_token: token, is_public: true })
  ).first();

  return row ? toRecord(row) : null;
}
