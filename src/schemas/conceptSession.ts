import Joi from 'joi';

const COMPONENT_TYPES = [
  'character',
  'variant',
  'setting',
  'prop',
  'lighting',
  'art_style',
] as const;

export const createSessionSchema = Joi.object({
  componentType: Joi.string()
    .valid(...COMPONENT_TYPES)
    .required(),
  componentId: Joi.string().uuid().required(),
});

export const sessionMessageSchema = Joi.object({
  content: Joi.string().trim().min(1).max(2000).required().messages({
    'any.required': 'content is required',
    'string.max': 'content must be 2000 characters or fewer',
  }),
});

// The only client-driven status transition is abandoning an active session.
export const updateSessionSchema = Joi.object({
  status: Joi.string().valid('ABANDONED').required(),
});

export const finalizeSessionSchema = Joi.object({
  selectedImageId: Joi.string().uuid().required(),
});
