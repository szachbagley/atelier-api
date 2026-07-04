import { Router } from 'express';
import path from 'node:path';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import * as artStyleRepository from '../db/repositories/artStyleRepository.js';
import * as characterRepository from '../db/repositories/characterRepository.js';
import * as lightingRepository from '../db/repositories/lightingRepository.js';
import * as propRepository from '../db/repositories/propRepository.js';
import * as settingRepository from '../db/repositories/settingRepository.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/codes.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate, validateQuery } from '../middleware/validate.js';
import {
  confirmSchema,
  listReferenceImagesQuerySchema,
  presignSchema,
} from '../schemas/referenceImage.js';
import * as storage from '../services/storage/storageService.js';
import type { ComponentType, ReferenceImage } from '../types/models.js';
import { logger } from '../utils/logger.js';
import { addActiveFilter, softDelete } from '../utils/softDelete.js';
import { projectIdOf } from './componentHelpers.js';

// Mounted at /projects/:projectId/reference-images.
export const referenceImagesRouter = Router({ mergeParams: true });

referenceImagesRouter.use(authenticate, requireProjectAccess);

// The referenced component must exist in this project — otherwise images
// could be attached to other users' components.
async function assertComponentInProject(
  projectId: string,
  componentType: ComponentType,
  componentId: string
): Promise<void> {
  let exists = false;
  switch (componentType) {
    case 'character':
      exists = !!(await characterRepository.findById(projectId, componentId));
      break;
    case 'variant': {
      const row = await db('variants')
        .join('characters', 'variants.character_id', 'characters.id')
        .where({ 'variants.id': componentId, 'characters.project_id': projectId })
        .whereNull('variants.deleted_at')
        .whereNull('characters.deleted_at')
        .first();
      exists = !!row;
      break;
    }
    case 'setting':
      exists = !!(await settingRepository.findById(projectId, componentId));
      break;
    case 'prop':
      exists = !!(await propRepository.findById(projectId, componentId));
      break;
    case 'lighting':
      exists = !!(await lightingRepository.findById(projectId, componentId));
      break;
    case 'art_style': {
      const artStyle = await artStyleRepository.get(projectId);
      exists = artStyle?.id === componentId;
      break;
    }
  }

  if (!exists) {
    throw new ValidationError('Referenced component not found in project', {
      fields: [{ field: 'componentId', message: `Unknown id: ${componentId}` }],
    });
  }
}

referenceImagesRouter.post('/presign', validate(presignSchema), async (req, res) => {
  const projectId = projectIdOf(req);
  const { filename, contentType, componentType, componentId } = req.body as {
    filename: string;
    contentType: string;
    componentType: ComponentType;
    componentId: string;
  };

  await assertComponentInProject(projectId, componentType, componentId);

  const imageId = uuid();
  const ext = path.extname(filename).toLowerCase();
  const s3Key = storage.getReferenceImageKey(projectId, imageId, ext);

  const uploadUrl = await storage.generatePresignedUploadUrl(s3Key, contentType);
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

  res.json({ uploadUrl, imageId, s3Key, expiresAt });
});

referenceImagesRouter.post('/confirm', validate(confirmSchema), async (req, res) => {
  const projectId = projectIdOf(req);
  const { imageId, s3Key, componentType, componentId, filename, contentType } =
    req.body as {
      imageId: string;
      s3Key: string;
      componentType: ComponentType;
      componentId: string;
      filename: string;
      contentType: string;
    };

  await assertComponentInProject(projectId, componentType, componentId);

  // The key must be the one presign issued for this project and image id —
  // never trust a client-supplied key blindly.
  const ext = path.extname(filename).toLowerCase();
  const expectedKey = storage.getReferenceImageKey(projectId, imageId, ext);
  if (s3Key !== expectedKey) {
    throw new ValidationError('s3Key does not match the presigned key', {
      fields: [{ field: 's3Key', message: 'Unexpected key' }],
    });
  }

  if (!(await storage.objectExists(s3Key))) {
    throw new AppError(
      ErrorCodes.UPL_S3_ERROR,
      502,
      'Uploaded object not found in storage'
    );
  }

  await db('reference_images').insert({
    id: imageId,
    component_type: componentType,
    component_id: componentId,
    s3_key: s3Key,
    filename,
    mime_type: contentType,
  });

  // Thumbnail generation is best-effort: the reference image itself is the
  // source of truth and remains usable if this fails.
  try {
    const original = await storage.downloadObject(s3Key);
    await storage.generateThumbnail(original, s3Key);
  } catch (err) {
    logger.warn({ err, s3Key }, 'reference image thumbnail generation failed');
  }

  res.status(201).json({
    id: imageId,
    url: await storage.getImageUrl(s3Key),
    filename,
  });
});

referenceImagesRouter.get(
  '/',
  validateQuery(listReferenceImagesQuerySchema),
  async (req, res) => {
    const { componentType, componentId } = req.query as {
      componentType?: ComponentType;
      componentId?: string;
    };

    let query = addActiveFilter(db<ReferenceImage>('reference_images'));
    if (componentType && componentId) {
      await assertComponentInProject(projectIdOf(req), componentType, componentId);
      query = query.where({
        component_type: componentType,
        component_id: componentId,
      });
    } else {
      // No component filter: constrain to keys under this project's prefix.
      query = query.where(
        's3_key',
        'like',
        `projects/${projectIdOf(req)}/references/%`
      );
    }

    const rows = await query.orderBy('uploaded_at');
    res.json({
      images: await Promise.all(
        rows.map(async (row) => ({
          id: row.id,
          filename: row.filename,
          url: await storage.getImageUrl(row.s3_key),
          uploadedAt: row.uploaded_at,
        }))
      ),
    });
  }
);

referenceImagesRouter.delete('/:imageId', async (req, res) => {
  const { imageId } = req.params as { imageId: string };

  // Scope by the project's key prefix so users can only delete their own.
  const image = await addActiveFilter(
    db<ReferenceImage>('reference_images')
      .where({ id: imageId })
      .where('s3_key', 'like', `projects/${projectIdOf(req)}/references/%`)
  ).first();

  if (!image) throw new NotFoundError('Reference image', imageId);

  // Soft delete only; S3 objects are cleaned up by lifecycle policy or a
  // background job, not inline.
  await softDelete(db, 'reference_images', imageId);
  res.status(204).send();
});
