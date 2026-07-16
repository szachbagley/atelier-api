import Joi from 'joi';

const title = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Title is required',
  'string.max': 'Title must be 255 characters or fewer',
});

export const createSceneSchema = Joi.object({
  title: title.required().messages({ 'any.required': 'Title is required' }),
  defaultSettingId: Joi.string().uuid().allow(null),
  defaultLightingId: Joi.string().uuid().allow(null),
});

export const updateSceneSchema = Joi.object({
  title,
  defaultSettingId: Joi.string().uuid().allow(null),
  defaultLightingId: Joi.string().uuid().allow(null),
}).min(1);

export const moveSceneSchema = Joi.object({
  targetActId: Joi.string().uuid().required().messages({
    'any.required': 'targetActId is required',
  }),
});

export { reorderSchema } from './act.js';
