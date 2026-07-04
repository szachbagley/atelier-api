import { Router } from 'express';
import { db } from '../db/index.js';
import * as projectRepository from '../db/repositories/projectRepository.js';
import { NotFoundError } from '../errors/index.js';
import type { Act, ArtStyle, Scene, Shot } from '../types/models.js';
import { addActiveFilter } from '../utils/softDelete.js';

export const sharedRouter = Router();

// Public, read-only view of a shared project: no authentication, addressed by
// the unguessable share token. Returns the full storyboard tree.
//
// Image URLs are placeholders (null) until the storage service lands in
// Phase 9, which will presign S3 URLs for generated images and thumbnails.
sharedRouter.get('/:shareToken', async (req, res) => {
  const { shareToken } = req.params as { shareToken: string };

  const project = await projectRepository.findByShareToken(shareToken);
  if (!project) {
    throw new NotFoundError('Shared project', shareToken);
  }

  const artStyle = await addActiveFilter(
    db<ArtStyle>('art_styles').where({ project_id: project.id })
  ).first();

  const acts = await addActiveFilter(
    db<Act>('acts').where({ project_id: project.id })
  ).orderBy('sequence_number');

  const actIds = acts.map((act) => act.id);
  const scenes = actIds.length
    ? await addActiveFilter(db<Scene>('scenes').whereIn('act_id', actIds)).orderBy(
        'sequence_number'
      )
    : [];

  const sceneIds = scenes.map((scene) => scene.id);
  const shots = sceneIds.length
    ? await addActiveFilter(
        db<Shot>('shots').whereIn('scene_id', sceneIds)
      ).orderBy('sequence_number')
    : [];

  const shotsByScene = new Map<string, Shot[]>();
  for (const shot of shots) {
    const list = shotsByScene.get(shot.scene_id) ?? [];
    list.push(shot);
    shotsByScene.set(shot.scene_id, list);
  }

  const scenesByAct = new Map<string, Scene[]>();
  for (const scene of scenes) {
    const list = scenesByAct.get(scene.act_id) ?? [];
    list.push(scene);
    scenesByAct.set(scene.act_id, list);
  }

  res.json({
    project: {
      id: project.id,
      title: project.title,
    },
    artStyle: artStyle
      ? {
          name: artStyle.name,
          description: artStyle.description,
          colorPalette: artStyle.color_palette,
          styleReferences: artStyle.style_references,
          technicalTerms: artStyle.technical_terms,
          aiDescription: artStyle.ai_description,
        }
      : null,
    acts: acts.map((act) => ({
      id: act.id,
      title: act.title,
      sequenceNumber: act.sequence_number,
      scenes: (scenesByAct.get(act.id) ?? []).map((scene) => ({
        id: scene.id,
        title: scene.title,
        sequenceNumber: scene.sequence_number,
        shots: (shotsByScene.get(scene.id) ?? []).map((shot) => ({
          id: shot.id,
          sequenceNumber: shot.sequence_number,
          description: shot.description,
          imageUrl: null,
          thumbnailUrl: null,
          annotations: shot.annotations,
          caption: shot.caption,
        })),
      })),
    })),
  });
});
