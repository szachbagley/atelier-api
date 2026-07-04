import Joi from 'joi';

const name = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Name is required',
  'string.max': 'Name must be 255 characters or fewer',
});
const text = Joi.string().max(10000).allow('', null);

export const createPropSchema = Joi.object({
  name: name.required().messages({ 'any.required': 'Name is required' }),
  description: text,
  handledBy: text,
  aiDescription: text,
});

export const updatePropSchema = Joi.object({
  name,
  description: text,
  handledBy: text,
  aiDescription: text,
}).min(1);
