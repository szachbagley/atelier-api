import { v4 as uuid } from 'uuid';
import type { Knex } from 'knex';
import { db } from '../index.js';
import * as storage from '../../services/storage/storageService.js';
import type {
  LightingSetup,
  Setting,
  Shot,
  ShotStatus,
} from '../../types/models.js';
import { toCamelRow } from '../../utils/caseMapping.js';
import { getNextSequenceNumber, SEQUENCE_GAP } from '../../utils/sequencing.js';
import { addActiveFilter, softDelete } from '../../utils/softDelete.js';

export interface ShotCharacterInput {
  characterId: string;
  variantId?: string | null;
}

export interface CreateShotData {
  description?: string | null;
  shotType?: string | null;
  cameraAngle?: string | null;
  cameraMovement?: string | null;
  settingId?: string | null;
  lightingId?: string | null;
  characters?: ShotCharacterInput[];
  props?: string[];
}

export interface UpdateShotData extends CreateShotData {
  annotations?: object | null;
  caption?: string | null;
}

export interface ShotRecord {
  id: string;
  sceneId: string;
  sequenceNumber: number;
  description: string | null;
  shotType: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  settingId: string | null;
  lightingId: string | null;
  generatedImageId: string | null;
  previousImageId: string | null;
  annotations: unknown | null;
  caption: string | null;
  compiledPrompt: string | null;
  editedPrompt: string | null;
  status: ShotStatus;
  createdAt: Date;
  updatedAt: Date;
}

export interface ShotCharacterInfo {
  characterId: string;
  characterName: string;
  variantId: string | null;
  variantName: string | null;
}

export interface ShotPropInfo {
  propId: string;
  propName: string;
}

export interface ShotListItem {
  id: string;
  sequenceNumber: number;
  description: string | null;
  shotType: string | null;
  cameraAngle: string | null;
  cameraMovement: string | null;
  status: ShotStatus;
  imageUrl: string | null;
  thumbnailUrl: string | null;
  characters: ShotCharacterInfo[];
}

export interface ShotDetail extends ShotRecord {
  characters: ShotCharacterInfo[];
  props: ShotPropInfo[];
  // Effective setting/lighting: the shot's own override, or the scene default.
  setting: (Record<string, unknown> & { source: 'shot' | 'scene' }) | null;
  lighting: (Record<string, unknown> & { source: 'shot' | 'scene' }) | null;
  imageUrl: string | null;
  thumbnailUrl: string | null;
}

function toShotRecord(row: Shot): ShotRecord {
  return toCamelRow<ShotRecord>(row);
}

async function loadCharacters(
  shotIds: string[]
): Promise<Map<string, ShotCharacterInfo[]>> {
  const byShot = new Map<string, ShotCharacterInfo[]>();
  if (!shotIds.length) return byShot;

  const rows = await db('shot_characters')
    .join('characters', 'shot_characters.character_id', 'characters.id')
    .leftJoin('variants', 'shot_characters.variant_id', 'variants.id')
    .whereIn('shot_characters.shot_id', shotIds)
    .select(
      'shot_characters.shot_id',
      'shot_characters.character_id',
      'characters.name as character_name',
      'shot_characters.variant_id',
      'variants.name as variant_name'
    )
    .orderBy('shot_characters.created_at');

  for (const row of rows as Array<{
    shot_id: string;
    character_id: string;
    character_name: string;
    variant_id: string | null;
    variant_name: string | null;
  }>) {
    const list = byShot.get(row.shot_id) ?? [];
    list.push({
      characterId: row.character_id,
      characterName: row.character_name,
      variantId: row.variant_id,
      variantName: row.variant_name,
    });
    byShot.set(row.shot_id, list);
  }
  return byShot;
}

async function loadProps(shotId: string): Promise<ShotPropInfo[]> {
  const rows = await db('shot_props')
    .join('props', 'shot_props.prop_id', 'props.id')
    .where({ 'shot_props.shot_id': shotId })
    .select('shot_props.prop_id', 'props.name as prop_name')
    .orderBy('shot_props.created_at');

  return (rows as Array<{ prop_id: string; prop_name: string }>).map((row) => ({
    propId: row.prop_id,
    propName: row.prop_name,
  }));
}

async function replaceJunctions(
  trx: Knex.Transaction,
  shotId: string,
  characters?: ShotCharacterInput[],
  props?: string[]
): Promise<void> {
  if (characters !== undefined) {
    await trx('shot_characters').where({ shot_id: shotId }).delete();
    if (characters.length) {
      await trx('shot_characters').insert(
        characters.map((c) => ({
          id: uuid(),
          shot_id: shotId,
          character_id: c.characterId,
          variant_id: c.variantId ?? null,
        }))
      );
    }
  }

  if (props !== undefined) {
    await trx('shot_props').where({ shot_id: shotId }).delete();
    if (props.length) {
      await trx('shot_props').insert(
        props.map((propId) => ({
          id: uuid(),
          shot_id: shotId,
          prop_id: propId,
        }))
      );
    }
  }
}

function shotColumnValues(
  data: CreateShotData | UpdateShotData
): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if ('description' in data) values.description = data.description ?? null;
  if ('shotType' in data) values.shot_type = data.shotType ?? null;
  if ('cameraAngle' in data) values.camera_angle = data.cameraAngle ?? null;
  if ('cameraMovement' in data)
    values.camera_movement = data.cameraMovement ?? null;
  if ('settingId' in data) values.setting_id = data.settingId ?? null;
  if ('lightingId' in data) values.lighting_id = data.lightingId ?? null;
  if ('caption' in data)
    values.caption = (data as UpdateShotData).caption ?? null;
  if ('annotations' in data) {
    const annotations = (data as UpdateShotData).annotations;
    values.annotations = annotations === null ? null : JSON.stringify(annotations);
  }
  return values;
}

export async function listByScene(sceneId: string): Promise<ShotListItem[]> {
  // Qualified soft-delete filter: the joined generated_images table has its
  // own deleted_at column.
  const rows = (await db<Shot>('shots')
    .where({ 'shots.scene_id': sceneId })
    .whereNull('shots.deleted_at')
    .leftJoin(
      'generated_images',
      'shots.generated_image_id',
      'generated_images.id'
    )
    .select('shots.*', 'generated_images.s3_key as image_s3_key')
    .orderBy('shots.sequence_number')) as Array<
    Shot & { image_s3_key: string | null }
  >;

  const characters = await loadCharacters(rows.map((row) => row.id));

  return Promise.all(
    rows.map(async (row) => ({
      id: row.id,
      sequenceNumber: row.sequence_number,
      description: row.description,
      shotType: row.shot_type,
      cameraAngle: row.camera_angle,
      cameraMovement: row.camera_movement,
      status: row.status,
      imageUrl: row.image_s3_key
        ? await storage.getImageUrl(row.image_s3_key)
        : null,
      thumbnailUrl: row.image_s3_key
        ? await storage.getThumbnailUrl(row.image_s3_key)
        : null,
      characters: characters.get(row.id) ?? [],
    }))
  );
}

// Look up a shot while verifying the full active chain:
// shot → scene → act → project.
export async function findInProject(
  projectId: string,
  shotId: string
): Promise<ShotRecord | null> {
  const row = await db<Shot>('shots')
    .join('scenes', 'shots.scene_id', 'scenes.id')
    .join('acts', 'scenes.act_id', 'acts.id')
    .where({ 'shots.id': shotId, 'acts.project_id': projectId })
    .whereNull('shots.deleted_at')
    .whereNull('scenes.deleted_at')
    .whereNull('acts.deleted_at')
    .select('shots.*')
    .first();

  return row ? toShotRecord(row) : null;
}

export async function findDetail(
  projectId: string,
  shotId: string
): Promise<ShotDetail | null> {
  const shot = await findInProject(projectId, shotId);
  if (!shot) return null;

  const scene = await db('scenes')
    .where({ id: shot.sceneId })
    .select('default_setting_id', 'default_lighting_id')
    .first();

  const effectiveSettingId = shot.settingId ?? scene?.default_setting_id ?? null;
  const effectiveLightingId =
    shot.lightingId ?? scene?.default_lighting_id ?? null;

  const setting = effectiveSettingId
    ? await addActiveFilter(
        db<Setting>('settings').where({ id: effectiveSettingId })
      ).first()
    : null;
  const lighting = effectiveLightingId
    ? await addActiveFilter(
        db<LightingSetup>('lighting_setups').where({ id: effectiveLightingId })
      ).first()
    : null;

  const characters = await loadCharacters([shotId]);

  let imageUrl: string | null = null;
  let thumbnailUrl: string | null = null;
  if (shot.generatedImageId) {
    const image = await db('generated_images')
      .where({ id: shot.generatedImageId })
      .select('s3_key')
      .first();
    if (image) {
      imageUrl = await storage.getImageUrl(image.s3_key);
      thumbnailUrl = await storage.getThumbnailUrl(image.s3_key);
    }
  }

  return {
    ...shot,
    characters: characters.get(shotId) ?? [],
    props: await loadProps(shotId),
    setting: setting
      ? { ...toCamelRow(setting), source: shot.settingId ? 'shot' : 'scene' }
      : null,
    lighting: lighting
      ? { ...toCamelRow(lighting), source: shot.lightingId ? 'shot' : 'scene' }
      : null,
    imageUrl,
    thumbnailUrl,
  };
}

export async function create(
  sceneId: string,
  data: CreateShotData
): Promise<ShotRecord> {
  const id = uuid();
  const sequenceNumber = await getNextSequenceNumber(
    db,
    'shots',
    'scene_id',
    sceneId
  );

  await db.transaction(async (trx) => {
    await trx('shots').insert({
      id,
      scene_id: sceneId,
      sequence_number: sequenceNumber,
      ...shotColumnValues(data),
    });
    await replaceJunctions(trx, id, data.characters, data.props);
  });

  const row = (await db<Shot>('shots').where({ id }).first()) as Shot;
  return toShotRecord(row);
}

export async function update(
  shotId: string,
  data: UpdateShotData
): Promise<ShotRecord> {
  await db.transaction(async (trx) => {
    const values = shotColumnValues(data);
    if (Object.keys(values).length) {
      await trx('shots')
        .where({ id: shotId })
        .update({ ...values, updated_at: trx.fn.now() });
    }
    await replaceJunctions(trx, shotId, data.characters, data.props);
  });

  const row = (await db<Shot>('shots').where({ id: shotId }).first()) as Shot;
  return toShotRecord(row);
}

export async function remove(id: string): Promise<void> {
  await softDelete(db, 'shots', id);
}

export async function reorder(
  sceneId: string,
  orderedIds: string[]
): Promise<number | null> {
  const existing = await addActiveFilter(
    db<Shot>('shots').where({ scene_id: sceneId })
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
      await trx('shots')
        .where({ id })
        .update({
          sequence_number: (index + 1) * SEQUENCE_GAP,
          updated_at: trx.fn.now(),
        });
    }
  });

  return orderedIds.length;
}

export async function move(
  shotId: string,
  targetSceneId: string
): Promise<ShotRecord> {
  const sequenceNumber = await getNextSequenceNumber(
    db,
    'shots',
    'scene_id',
    targetSceneId
  );

  await db('shots').where({ id: shotId }).update({
    scene_id: targetSceneId,
    sequence_number: sequenceNumber,
    updated_at: db.fn.now(),
  });

  const row = (await db<Shot>('shots').where({ id: shotId }).first()) as Shot;
  return toShotRecord(row);
}
