import Joi from 'joi';

const name = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Name is required',
  'string.max': 'Name must be 255 characters or fewer',
});
const text = Joi.string().max(10000).allow('', null);

export const createCharacterSchema = Joi.object({
  name: name.required().messages({ 'any.required': 'Name is required' }),
  physicalDescription: text,
  defaultAppearance: text,
  personality: text,
  aiDescription: text,
});

export const updateCharacterSchema = Joi.object({
  name,
  physicalDescription: text,
  defaultAppearance: text,
  personality: text,
  aiDescription: text,
}).min(1);
