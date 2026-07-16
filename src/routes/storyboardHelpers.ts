import * as characterRepository from '../db/repositories/characterRepository.js';
import * as lightingRepository from '../db/repositories/lightingRepository.js';
import * as propRepository from '../db/repositories/propRepository.js';
import * as settingRepository from '../db/repositories/settingRepository.js';
import * as variantRepository from '../db/repositories/variantRepository.js';
import { ValidationError } from '../errors/index.js';
import type { ShotCharacterInput } from '../db/repositories/shotRepository.js';

// Body-referenced component IDs must belong to the same project — otherwise a
// user could attach another user's components to their shots/scenes. Throws
// 400 ValidationError naming the offending field.
export async function assertComponentRefsInProject(
  projectId: string,
  refs: {
    settingId?: string | null;
    lightingId?: string | null;
    defaultSettingId?: string | null;
    defaultLightingId?: string | null;
    characters?: ShotCharacterInput[];
    props?: string[];
  }
): Promise<void> {
  const fail = (field: string, id: string): never => {
    throw new ValidationError('Referenced component not found in project', {
      fields: [{ field, message: `Unknown id: ${id}` }],
    });
  };

  const settingId = refs.settingId ?? refs.defaultSettingId;
  if (settingId && !(await settingRepository.findById(projectId, settingId))) {
    fail(refs.settingId ? 'settingId' : 'defaultSettingId', settingId);
  }

  const lightingId = refs.lightingId ?? refs.defaultLightingId;
  if (
    lightingId &&
    !(await lightingRepository.findById(projectId, lightingId))
  ) {
    fail(refs.lightingId ? 'lightingId' : 'defaultLightingId', lightingId);
  }

  for (const entry of refs.characters ?? []) {
    const character = await characterRepository.findById(
      projectId,
      entry.characterId
    );
    if (!character) fail('characters', entry.characterId);
    if (
      entry.variantId &&
      !(await variantRepository.findById(entry.characterId, entry.variantId))
    ) {
      fail('characters', entry.variantId);
    }
  }

  for (const propId of refs.props ?? []) {
    if (!(await propRepository.findById(projectId, propId))) {
      fail('props', propId);
    }
  }
}
