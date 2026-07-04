import { db } from '../db/index.js';
import * as artStyleRepository from '../db/repositories/artStyleRepository.js';
import * as characterRepository from '../db/repositories/characterRepository.js';
import * as lightingRepository from '../db/repositories/lightingRepository.js';
import * as propRepository from '../db/repositories/propRepository.js';
import * as settingRepository from '../db/repositories/settingRepository.js';
import { ValidationError } from '../errors/index.js';
import type { ComponentType } from '../types/models.js';

// Verify a (componentType, componentId) pair exists in the project — used by
// reference images and concept art sessions, which attach to any component.
export async function componentExistsInProject(
  projectId: string,
  componentType: ComponentType,
  componentId: string
): Promise<boolean> {
  switch (componentType) {
    case 'character':
      return !!(await characterRepository.findById(projectId, componentId));
    case 'variant': {
      const row = await db('variants')
        .join('characters', 'variants.character_id', 'characters.id')
        .where({
          'variants.id': componentId,
          'characters.project_id': projectId,
        })
        .whereNull('variants.deleted_at')
        .whereNull('characters.deleted_at')
        .first();
      return !!row;
    }
    case 'setting':
      return !!(await settingRepository.findById(projectId, componentId));
    case 'prop':
      return !!(await propRepository.findById(projectId, componentId));
    case 'lighting':
      return !!(await lightingRepository.findById(projectId, componentId));
    case 'art_style': {
      const artStyle = await artStyleRepository.get(projectId);
      return artStyle?.id === componentId;
    }
    default:
      return false;
  }
}

export async function assertComponentInProject(
  projectId: string,
  componentType: ComponentType,
  componentId: string
): Promise<void> {
  if (!(await componentExistsInProject(projectId, componentType, componentId))) {
    throw new ValidationError('Referenced component not found in project', {
      fields: [{ field: 'componentId', message: `Unknown id: ${componentId}` }],
    });
  }
}

// The DB table + human label per component type (ai_description updates,
// description prompts).
export const COMPONENT_TABLES: Record<ComponentType, string> = {
  character: 'characters',
  variant: 'variants',
  setting: 'settings',
  prop: 'props',
  lighting: 'lighting_setups',
  art_style: 'art_styles',
};

export const COMPONENT_LABELS: Record<ComponentType, string> = {
  character: 'film character',
  variant: 'film character variant',
  setting: 'film location/setting',
  prop: 'film prop',
  lighting: 'cinematic lighting setup',
  art_style: 'visual art style for a film',
};
