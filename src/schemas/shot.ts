import Joi from 'joi';

const SHOT_TYPES = [
  'EWS',
  'WS',
  'FS',
  'MWS',
  'MS',
  'MCU',
  'CU',
  'ECU',
  'OTS',
  'POV',
  'TWO_SHOT',
  'INSERT',
  'ESTABLISHING',
] as const;

const CAMERA_ANGLES = [
  'EYE_LEVEL',
  'LOW_ANGLE',
  'HIGH_ANGLE',
  'BIRDS_EYE',
  'DUTCH_ANGLE',
  'WORMS_EYE',
] as const;

const CAMERA_MOVEMENTS = [
  'STATIC',
  'PAN',
  'TILT',
  'DOLLY',
  'CRANE',
  'HANDHELD',
  'ZOOM',
] as const;

const ANNOTATION_SYMBOLS = [
  'camera_push',
  'camera_pull',
  'camera_pan_left',
  'camera_pan_right',
  'camera_tilt_up',
  'camera_tilt_down',
  'camera_crane_up',
  'camera_crane_down',
  'character_move',
  'character_enter',
  'character_exit',
  'focus_point',
  'eyeline',
] as const;

// --- AnnotationLayer (docs/DATABASE.md §Annotations Schema) ---

const percent = Joi.number().min(0).max(100);
const hexColor = Joi.string().pattern(/^#[0-9a-fA-F]{3,8}$/);

const baseAnnotation = {
  id: Joi.string().required(),
  x: percent.required(),
  y: percent.required(),
  rotation: Joi.number().required(),
  zIndex: Joi.number().integer().required(),
};

const arrowAnnotation = Joi.object({
  ...baseAnnotation,
  type: Joi.string().valid('arrow').required(),
  endX: percent.required(),
  endY: percent.required(),
  color: hexColor.required(),
  strokeWidth: Joi.number().positive().required(),
  arrowStyle: Joi.string().valid('single', 'double', 'curved').required(),
  label: Joi.string().max(500),
});

const textBoxAnnotation = Joi.object({
  ...baseAnnotation,
  type: Joi.string().valid('textBox').required(),
  width: Joi.number().positive().required(),
  height: Joi.number().positive().required(),
  content: Joi.string().max(2000).allow('').required(),
  fontSize: Joi.number().positive().required(),
  fontColor: hexColor.required(),
  backgroundColor: hexColor.required(),
  borderColor: hexColor.required(),
});

const symbolAnnotation = Joi.object({
  ...baseAnnotation,
  type: Joi.string().valid('symbol').required(),
  symbol: Joi.string()
    .valid(...ANNOTATION_SYMBOLS)
    .required(),
  scale: Joi.number().positive().required(),
  color: hexColor.required(),
});

export const annotationLayerSchema = Joi.object({
  version: Joi.number().valid(1).required(),
  elements: Joi.array()
    .items(
      Joi.alternatives()
        .conditional('.type', {
          switch: [
            { is: 'arrow', then: arrowAnnotation },
            { is: 'textBox', then: textBoxAnnotation },
            { is: 'symbol', then: symbolAnnotation },
          ],
          otherwise: Joi.forbidden(),
        })
    )
    .required(),
});

// --- Shot CRUD ---

const text = Joi.string().max(5000).allow('', null);
const shotType = Joi.string()
  .valid(...SHOT_TYPES)
  .allow(null);
const cameraAngle = Joi.string()
  .valid(...CAMERA_ANGLES)
  .allow(null);
const cameraMovement = Joi.string()
  .valid(...CAMERA_MOVEMENTS)
  .allow(null);
const characters = Joi.array()
  .items(
    Joi.object({
      characterId: Joi.string().uuid().required(),
      variantId: Joi.string().uuid().allow(null),
    })
  )
  .unique((a, b) => a.characterId === b.characterId);
const props = Joi.array().items(Joi.string().uuid()).unique();

export const createShotSchema = Joi.object({
  description: text,
  shotType,
  cameraAngle,
  cameraMovement,
  settingId: Joi.string().uuid().allow(null),
  lightingId: Joi.string().uuid().allow(null),
  characters,
  props,
});

export const updateShotSchema = Joi.object({
  description: text,
  shotType,
  cameraAngle,
  cameraMovement,
  settingId: Joi.string().uuid().allow(null),
  lightingId: Joi.string().uuid().allow(null),
  characters,
  props,
  annotations: annotationLayerSchema.allow(null),
  caption: text,
}).min(1);

export const generateShotSchema = Joi.object({
  editedPrompt: Joi.string().trim().min(1).max(1500).messages({
    'string.max': 'editedPrompt must be 1500 characters or fewer',
  }),
});

export const generateImageSchema = Joi.object({
  prompt: Joi.string().trim().min(1).max(1500).required().messages({
    'any.required': 'prompt is required',
    'string.max': 'prompt must be 1500 characters or fewer',
  }),
});

export const moveShotSchema = Joi.object({
  targetSceneId: Joi.string().uuid().required().messages({
    'any.required': 'targetSceneId is required',
  }),
});

export { reorderSchema } from './act.js';
