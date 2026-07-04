// Natural-language expansions of the storyboard enums, used by the prompt
// compiler section builders (docs/BACKEND.md §Descriptors).

export const SHOT_TYPE_DESCRIPTIONS: Record<string, string> = {
  EWS: 'extreme wide shot showing vast environment with small figures',
  WS: 'wide shot showing full environment and complete figures',
  FS: 'full shot showing complete figure from head to toe',
  MWS: 'medium wide shot showing figure from knees up',
  MS: 'medium shot showing figure from waist up',
  MCU: 'medium close-up showing figure from chest up',
  CU: 'close-up shot focused on face',
  ECU: 'extreme close-up showing specific detail',
  OTS: 'over-the-shoulder shot looking past one figure toward another',
  POV: 'point-of-view shot from character perspective',
  TWO_SHOT: 'two-shot framing two figures together',
  INSERT: 'insert shot focusing on specific object or detail',
  ESTABLISHING: 'establishing shot introducing location',
};

export const CAMERA_ANGLE_DESCRIPTIONS: Record<string, string> = {
  EYE_LEVEL: 'eye-level camera angle',
  LOW_ANGLE: 'low-angle shot looking upward',
  HIGH_ANGLE: 'high-angle shot looking downward',
  BIRDS_EYE: "bird's-eye view from directly above",
  DUTCH_ANGLE: 'dutch angle with tilted horizon',
  WORMS_EYE: "worm's-eye view from ground level looking up",
};

export const CAMERA_MOVEMENT_DESCRIPTIONS: Record<string, string> = {
  STATIC: 'static camera with no movement',
  PAN: 'panning camera movement',
  TILT: 'tilting camera movement',
  DOLLY: 'dolly camera movement',
  CRANE: 'crane camera movement',
  HANDHELD: 'handheld camera feel',
  ZOOM: 'zooming camera movement',
};

export const TIME_OF_DAY_DESCRIPTIONS: Record<string, string> = {
  dawn: 'at dawn with soft pink and orange light on the horizon',
  morning: 'in morning light with warm golden tones',
  midday: 'under bright midday sun with harsh shadows',
  afternoon: 'in warm afternoon light',
  dusk: 'at dusk with purple and orange sky',
  night: 'at night with darkness and artificial or moonlight',
  unspecified: '',
};

export const WEATHER_DESCRIPTIONS: Record<string, string> = {
  clear: 'clear skies',
  cloudy: 'overcast with diffused light',
  rain: 'during rainfall with wet surfaces',
  snow: 'with falling snow and winter atmosphere',
  fog: 'in fog with limited visibility and muted colors',
  storm: 'during storm with dramatic clouds and wind',
  unspecified: '',
};
