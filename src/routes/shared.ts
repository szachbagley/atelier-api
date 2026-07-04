import { Router } from 'express';
import { db } from '../db/index.js';
import * as projectRepository from '../db/repositories/projectRepository.js';
import { NotFoundError } from '../errors/index.js';
import * as storage from '../services/storage/storageService.js';
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
    ? ((await db<Shot>('shots')
        .whereIn('shots.scene_id', sceneIds)
        .whereNull('shots.deleted_at')
        .leftJoin(
          'generated_images',
          'shots.generated_image_id',
          'generated_images.id'
        )
        .select('shots.*', 'generated_images.s3_key as image_s3_key')
        .orderBy('shots.sequence_number')) as Array<
        Shot & { image_s3_key: string | null }
      >)
    : [];

  type SharedShot = Shot & { image_s3_key: string | null };
  const shotsByScene = new Map<string, SharedShot[]>();
  for (const shot of shots) {
    const list = shotsByScene.get(shot.scene_id) ?? [];
    list.push(shot);
    shotsByScene.set(shot.scene_id, list);
  }

  const shotView = async (shot: SharedShot): Promise<object> => ({
    id: shot.id,
    sequenceNumber: shot.sequence_number,
    description: shot.description,
    imageUrl: shot.image_s3_key
      ? await storage.getImageUrl(shot.image_s3_key)
      : null,
    thumbnailUrl: shot.image_s3_key
      ? await storage.getThumbnailUrl(shot.image_s3_key)
      : null,
    annotations: shot.annotations,
    caption: shot.caption,
  });

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
    acts: await Promise.all(
      acts.map(async (act) => ({
        id: act.id,
        title: act.title,
        sequenceNumber: act.sequence_number,
        scenes: await Promise.all(
          (scenesByAct.get(act.id) ?? []).map(async (scene) => ({
            id: scene.id,
            title: scene.title,
            sequenceNumber: scene.sequence_number,
            shots: await Promise.all(
              (shotsByScene.get(scene.id) ?? []).map(shotView)
            ),
          }))
        ),
      }))
    ),
  });
});
