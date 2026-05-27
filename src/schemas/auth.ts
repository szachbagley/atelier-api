import Joi from 'joi';

const passwordComplexity = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/;

export const registerSchema = Joi.object({
  email: Joi.string().email().max(255).required().messages({
    'string.email': 'Please enter a valid email address',
    'string.max': 'Email must be 255 characters or fewer',
    'any.required': 'Email is required',
  }),
  password: Joi.string()
    .min(8)
    .max(128)
    .pattern(passwordComplexity)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.max': 'Password must be 128 characters or fewer',
      'string.pattern.base':
        'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required',
    }),
});

export const loginSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please enter a valid email address',
    'any.required': 'Email is required',
  }),
  password: Joi.string().required().messages({
    'any.required': 'Password is required',
  }),
});
