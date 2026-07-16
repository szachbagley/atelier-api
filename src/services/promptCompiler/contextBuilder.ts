import { db } from '../../db/index.js';
import type {
  ArtStyle,
  Character,
  LightingSetup,
  Prop,
  Scene,
  Setting,
  Shot,
  Variant,
} from '../../types/models.js';
import { addActiveFilter } from '../../utils/softDelete.js';
import type { ShotContext } from './PromptCompiler.js';

// Assembles everything the prompt compiler needs for a shot: the shot row,
// its scene, the project's art style, characters (+variants), the effective
// setting/lighting (shot override or scene default), and props. The caller
// must already have verified project access to the shot.
export async function buildShotContext(
  projectId: string,
  shotId: string
): Promise<ShotContext | null> {
  const shot = await db<Shot>('shots')
    .join('scenes', 'shots.scene_id', 'scenes.id')
    .join('acts', 'scenes.act_id', 'acts.id')
    .where({ 'shots.id': shotId, 'acts.project_id': projectId })
    .whereNull('shots.deleted_at')
    .whereNull('scenes.deleted_at')
    .whereNull('acts.deleted_at')
    .select('shots.*')
    .first();
  if (!shot) return null;

  const scene = (await db<Scene>('scenes')
    .where({ id: shot.scene_id })
    .first()) as Scene;

  const artStyle =
    (await addActiveFilter(
      db<ArtStyle>('art_styles').where({ project_id: projectId })
    ).first()) ?? null;

  const characterRows = (await db('shot_characters')
    .join('characters', 'shot_characters.character_id', 'characters.id')
    .leftJoin('variants', 'shot_characters.variant_id', 'variants.id')
    .where({ 'shot_characters.shot_id': shotId })
    .whereNull('characters.deleted_at')
    .select(
      db.raw('characters.*'),
      'variants.id as v_id',
      'variants.name as v_name',
      'variants.description as v_description',
      'variants.ai_description as v_ai_description'
    )
    .orderBy('shot_characters.created_at')) as Array<
    Character & {
      v_id: string | null;
      v_name: string | null;
      v_description: string | null;
      v_ai_description: string | null;
    }
  >;

  const characters = characterRows.map((row) => ({
    character: row as Character,
    variant: row.v_id
      ? ({
          id: row.v_id,
          character_id: row.id,
          name: row.v_name,
          description: row.v_description,
          ai_description: row.v_ai_description,
        } as Variant)
      : undefined,
  }));

  const effectiveSettingId = shot.setting_id ?? scene.default_setting_id;
  const setting = effectiveSettingId
    ? ((await addActiveFilter(
        db<Setting>('settings').where({ id: effectiveSettingId })
      ).first()) ?? null)
    : null;

  const effectiveLightingId = shot.lighting_id ?? scene.default_lighting_id;
  const lighting = effectiveLightingId
    ? ((await addActiveFilter(
        db<LightingSetup>('lighting_setups').where({
          id: effectiveLightingId,
        })
      ).first()) ?? null)
    : null;

  const props = (await db('shot_props')
    .join('props', 'shot_props.prop_id', 'props.id')
    .where({ 'shot_props.shot_id': shotId })
    .whereNull('props.deleted_at')
    .select(db.raw('props.*'))
    .orderBy('shot_props.created_at')) as Prop[];

  return { shot, scene, artStyle, characters, setting, lighting, props };
}
