/**
 * Database model interfaces.
 *
 * Mirrors the schema documented in docs/DATABASE.md. One interface per table,
 * with column names and nullability matching the SQL definitions exactly.
 */

// --- Enums ---

export type ApiKeyProvider = 'gemini' | 'openai' | 'stability' | 'midjourney';

export type TimeOfDay =
  | 'dawn'
  | 'morning'
  | 'midday'
  | 'afternoon'
  | 'dusk'
  | 'night'
  | 'unspecified';

export type Weather =
  | 'clear'
  | 'cloudy'
  | 'rain'
  | 'snow'
  | 'fog'
  | 'storm'
  | 'unspecified';

export type ShotType =
  | 'EWS'
  | 'WS'
  | 'FS'
  | 'MWS'
  | 'MS'
  | 'MCU'
  | 'CU'
  | 'ECU'
  | 'OTS'
  | 'POV'
  | 'TWO_SHOT'
  | 'INSERT'
  | 'ESTABLISHING';

export type CameraAngle =
  | 'EYE_LEVEL'
  | 'LOW_ANGLE'
  | 'HIGH_ANGLE'
  | 'BIRDS_EYE'
  | 'DUTCH_ANGLE'
  | 'WORMS_EYE';

export type CameraMovement =
  | 'STATIC'
  | 'PAN'
  | 'TILT'
  | 'DOLLY'
  | 'CRANE'
  | 'HANDHELD'
  | 'ZOOM';

export type ShotStatus = 'DRAFT' | 'GENERATING' | 'GENERATED' | 'FAILED';

export type ComponentType =
  | 'character'
  | 'variant'
  | 'setting'
  | 'prop'
  | 'lighting'
  | 'art_style';

export type ConceptArtSessionStatus = 'ACTIVE' | 'COMPLETED' | 'ABANDONED';

export type ConceptArtMessageRole = 'user' | 'assistant' | 'system';

// --- Users & Auth ---

export interface User {
  id: string;
  email: string;
  password_hash: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface UserApiKey {
  id: string;
  user_id: string;
  provider: ApiKeyProvider;
  encrypted_key: string;
  key_hint: string | null;
  is_valid: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface RefreshToken {
  id: string;
  user_id: string;
  token_hash: string;
  expires_at: Date;
  created_at: Date;
  revoked_at: Date | null;
  replaced_by_id: string | null;
  user_agent: string | null;
  ip_address: string | null;
}

// --- Projects ---

export interface Project {
  id: string;
  user_id: string;
  title: string;
  share_token: string | null;
  is_public: boolean;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// --- Art Style ---

export interface ArtStyle {
  id: string;
  project_id: string;
  name: string | null;
  description: string | null;
  color_palette: string | null;
  style_references: string | null;
  technical_terms: string[] | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// --- Component Library ---

export interface Character {
  id: string;
  project_id: string;
  name: string;
  physical_description: string | null;
  default_appearance: string | null;
  personality: string | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Variant {
  id: string;
  character_id: string;
  name: string;
  description: string | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Setting {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  set_dressing: string | null;
  time_of_day: TimeOfDay;
  weather: Weather;
  lighting: string | null;
  mood: string | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Prop {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  handled_by: string | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface LightingSetup {
  id: string;
  project_id: string;
  name: string;
  description: string | null;
  mood: string | null;
  ai_description: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// --- Storyboard Structure ---

export interface Act {
  id: string;
  project_id: string;
  title: string;
  sequence_number: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Scene {
  id: string;
  act_id: string;
  title: string;
  sequence_number: number;
  default_setting_id: string | null;
  default_lighting_id: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface Shot {
  id: string;
  scene_id: string;
  sequence_number: number;
  description: string | null;
  shot_type: ShotType | null;
  camera_angle: CameraAngle | null;
  camera_movement: CameraMovement | null;
  setting_id: string | null;
  lighting_id: string | null;
  generated_image_id: string | null;
  previous_image_id: string | null;
  annotations: unknown | null;
  caption: string | null;
  compiled_prompt: string | null;
  edited_prompt: string | null;
  status: ShotStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

// --- Junction Tables ---

export interface ShotCharacter {
  id: string;
  shot_id: string;
  character_id: string;
  variant_id: string | null;
  created_at: Date;
}

export interface ShotProp {
  id: string;
  shot_id: string;
  prop_id: string;
  created_at: Date;
}

// --- Images ---

export interface GeneratedImage {
  id: string;
  project_id: string;
  s3_key: string;
  prompt: string | null;
  provider: string | null;
  model: string | null;
  width: number | null;
  height: number | null;
  created_at: Date;
  deleted_at: Date | null;
}

export interface ReferenceImage {
  id: string;
  component_type: ComponentType;
  component_id: string;
  s3_key: string;
  filename: string | null;
  mime_type: string | null;
  uploaded_at: Date;
  deleted_at: Date | null;
}

// --- Concept Art Sessions ---

export interface ConceptArtSession {
  id: string;
  project_id: string;
  component_type: ComponentType;
  component_id: string | null;
  status: ConceptArtSessionStatus;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
}

export interface ConceptArtMessage {
  id: string;
  session_id: string;
  role: ConceptArtMessageRole;
  content: string | null;
  generated_image_id: string | null;
  created_at: Date;
}
