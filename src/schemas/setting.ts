import Joi from 'joi';

const TIME_OF_DAY = [
  'dawn',
  'morning',
  'midday',
  'afternoon',
  'dusk',
  'night',
  'unspecified',
] as const;

const WEATHER = [
  'clear',
  'cloudy',
  'rain',
  'snow',
  'fog',
  'storm',
  'unspecified',
] as const;

const name = Joi.string().trim().min(1).max(255).messages({
  'string.empty': 'Name is required',
  'string.max': 'Name must be 255 characters or fewer',
});
const text = Joi.string().max(10000).allow('', null);
const timeOfDay = Joi.string().valid(...TIME_OF_DAY);
const weather = Joi.string().valid(...WEATHER);

export const createSettingSchema = Joi.object({
  name: name.required().messages({ 'any.required': 'Name is required' }),
  description: text,
  setDressing: text,
  timeOfDay,
  weather,
  lighting: text,
  mood: text,
  aiDescription: text,
});

export const updateSettingSchema = Joi.object({
  name,
  description: text,
  setDressing: text,
  timeOfDay,
  weather,
  lighting: text,
  mood: text,
  aiDescription: text,
}).min(1);
