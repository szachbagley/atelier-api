import Joi from 'joi';

// Only Gemini is supported for MVP. The DB enum allows more providers, but the
// API surface is intentionally restricted until those integrations exist.
const provider = Joi.string().valid('gemini').required().messages({
  'any.only': 'Unsupported provider; only "gemini" is supported',
  'any.required': 'Provider is required',
});

export const addApiKeySchema = Joi.object({
  provider,
  apiKey: Joi.string().trim().min(1).max(500).required().messages({
    'string.empty': 'API key is required',
    'string.max': 'API key must be 500 characters or fewer',
    'any.required': 'API key is required',
  }),
});

export const providerParamSchema = Joi.object({
  provider,
});
