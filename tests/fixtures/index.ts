import type { Knex } from 'knex';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { v4 as uuid } from 'uuid';
import type { ShotContext } from '../../src/services/promptCompiler/index.js';
import type {
  Character,
  Scene,
  Shot,
} from '../../src/types/models.js';

// ---------------------------------------------------------------------------
// Pure fixture — no DB. Used by the prompt-compiler unit tests.
// ---------------------------------------------------------------------------

const now = new Date();

function baseShot(): Shot {
  return {
    id: uuid(),
    scene_id: uuid(),
    sequence_number: 1000,
    description: 'A hero stands at the edge of a cliff',
    shot_type: 'MS',
    camera_angle: 'EYE_LEVEL',
    camera_movement: null,
    setting_id: null,
    lighting_id: null,
    generated_image_id: null,
    previous_image_id: null,
    annotations: null,
    caption: null,
    compiled_prompt: null,
    edited_prompt: null,
    status: 'DRAFT',
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function baseScene(): Scene {
  return {
    id: uuid(),
    act_id: uuid(),
    title: 'Scene 1',
    sequence_number: 1000,
    default_setting_id: null,
    default_lighting_id: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function baseCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: uuid(),
    project_id: uuid(),
    name: 'Ada',
    physical_description: 'tall, dark hair, weathered coat',
    default_appearance: null,
    personality: null,
    ai_description: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
    ...overrides,
  };
}

/**
 * Build a ShotContext for prompt-compiler tests. Top-level keys can be
 * overridden; anything omitted falls back to a sensible populated default.
 */
export function createMockShotContext(
  overrides: Partial<ShotContext> = {}
): ShotContext {
  return {
    shot: baseShot(),
    scene: baseScene(),
    artStyle: {
      id: uuid(),
      project_id: uuid(),
      name: 'House style',
      description: 'moody noir ink wash',
      color_palette: null,
      style_references: null,
      technical_terms: null,
      ai_description: null,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    },
    characters: [{ character: baseCharacter() }],
    setting: null,
    lighting: null,
    props: [],
    ...overrides,
  };
}

export { baseCharacter as mockCharacter };

// ---------------------------------------------------------------------------
// DB factories — used by the integration suite. Each takes a live Knex handle.
// ---------------------------------------------------------------------------

export interface TestUser {
  userId: string;
  email: string;
  token: string;
}

export async function createTestUser(
  db: Knex,
  overrides: { email?: string; password?: string } = {}
): Promise<TestUser> {
  const userId = uuid();
  const email = overrides.email ?? `user-${userId.slice(0, 8)}@example.com`;
  const password = overrides.password ?? 'Password123';
  const passwordHash = await bcrypt.hash(password, 4);

  await db('users').insert({ id: userId, email, password_hash: passwordHash });

  const token = jwt.sign(
    { sub: userId, email, type: 'access' },
    process.env.JWT_ACCESS_SECRET as string,
    { expiresIn: '15m', algorithm: 'HS256' }
  );

  return { userId, email, token };
}

export async function createTestProject(
  db: Knex,
  userId: string,
  overrides: { title?: string } = {}
): Promise<{ id: string }> {
  const id = uuid();
  await db('projects').insert({
    id,
    user_id: userId,
    title: overrides.title ?? 'Test Project',
  });
  // Projects are created with a default (empty) art style row.
  await db('art_styles').insert({ id: uuid(), project_id: id });
  return { id };
}

export async function createTestAct(
  db: Knex,
  projectId: string,
  overrides: { title?: string; sequenceNumber?: number } = {}
): Promise<{ id: string }> {
  const id = uuid();
  await db('acts').insert({
    id,
    project_id: projectId,
    title: overrides.title ?? 'Act I',
    sequence_number: overrides.sequenceNumber ?? 1000,
  });
  return { id };
}

export async function createTestScene(
  db: Knex,
  actId: string,
  overrides: { title?: string; sequenceNumber?: number } = {}
): Promise<{ id: string }> {
  const id = uuid();
  await db('scenes').insert({
    id,
    act_id: actId,
    title: overrides.title ?? 'Scene 1',
    sequence_number: overrides.sequenceNumber ?? 1000,
  });
  return { id };
}

export async function createTestShot(
  db: Knex,
  sceneId: string,
  overrides: { description?: string; sequenceNumber?: number } = {}
): Promise<{ id: string }> {
  const id = uuid();
  await db('shots').insert({
    id,
    scene_id: sceneId,
    sequence_number: overrides.sequenceNumber ?? 1000,
    description: overrides.description ?? 'A test shot',
    status: 'DRAFT',
  });
  return { id };
}

export async function createTestCharacter(
  db: Knex,
  projectId: string,
  overrides: { name?: string } = {}
): Promise<{ id: string }> {
  const id = uuid();
  await db('characters').insert({
    id,
    project_id: projectId,
    name: overrides.name ?? 'Test Character',
  });
  return { id };
}
