import Joi from 'joi';

const title = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Title is required',
  'string.max': 'Title must be 255 characters or fewer',
});

export const createProjectSchema = Joi.object({
  title: title.required().messages({
    'any.required': 'Title is required',
  }),
});

export const updateProjectSchema = Joi.object({
  title,
})
  .min(1)
  .messages({
    'object.min': 'At least one field must be provided',
  });
