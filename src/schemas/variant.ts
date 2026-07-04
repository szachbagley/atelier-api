import Joi from 'joi';

const name = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Name is required',
  'string.max': 'Name must be 255 characters or fewer',
});
const text = Joi.string().max(10000).allow('', null);

export const createVariantSchema = Joi.object({
  name: name.required().messages({ 'any.required': 'Name is required' }),
  description: text,
  aiDescription: text,
});

export const updateVariantSchema = Joi.object({
  name,
  description: text,
  aiDescription: text,
}).min(1);
