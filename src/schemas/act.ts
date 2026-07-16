import Joi from 'joi';

const title = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Title is required',
  'string.max': 'Title must be 255 characters or fewer',
});

export const createActSchema = Joi.object({
  title: title.required().messages({ 'any.required': 'Title is required' }),
});

export const updateActSchema = Joi.object({
  title,
}).min(1);

export const reorderSchema = Joi.object({
  orderedIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .unique()
    .required()
    .messages({
      'any.required': 'orderedIds is required',
      'array.min': 'orderedIds must contain at least one id',
      'array.unique': 'orderedIds must not contain duplicates',
    }),
});
