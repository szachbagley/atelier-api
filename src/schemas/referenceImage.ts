import Joi from 'joi';
import { storageConfig } from '../config/storage.js';

const COMPONENT_TYPES = [
  'character',
  'variant',
  'setting',
  'prop',
  'lighting',
  'art_style',
] as const;

const componentType = Joi.string()
  .valid(...COMPONENT_TYPES)
  .required();
const componentId = Joi.string().uuid().required();
const filename = Joi.string()
  .trim()
  .min(1)
  .max(255)
  .pattern(/\.(jpe?g|png|webp)$/i)
  .required()
  .messages({
    'string.pattern.base':
      'Filename must end in one of: .jpg, .jpeg, .png, .webp',
  });
const contentType = Joi.string()
  .valid(...storageConfig.limits.referenceImage.allowedMimeTypes)
  .required()
  .messages({
    'any.only': 'contentType must be one of image/jpeg, image/png, image/webp',
  });

export const presignSchema = Joi.object({
  filename,
  contentType,
  componentType,
  componentId,
});

export const confirmSchema = Joi.object({
  imageId: Joi.string().uuid().required(),
  s3Key: Joi.string().max(512).required(),
  componentType,
  componentId,
  filename,
  contentType,
});

export const listReferenceImagesQuerySchema = Joi.object({
  componentType: Joi.string().valid(...COMPONENT_TYPES),
  componentId: Joi.string().uuid(),
}).and('componentType', 'componentId');
