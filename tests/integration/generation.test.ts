import { describe, it, expect, beforeEach, vi } from 'vitest';
import { v4 as uuid } from 'uuid';
import request from 'supertest';

// Mock the external boundaries: Gemini (no real API/key) and S3 storage (no
// real bucket). The generation pipeline, status machine, and persistence are
// exercised for real against the Testcontainers MySQL.
vi.mock('../../src/services/imageGeneration/geminiClient.js', () => ({
  IMAGE_MODEL: 'imagen-3.0-generate-002',
  TEXT_MODEL: 'gemini-2.5-flash',
  generateImage: vi.fn(async () => ({
    imageBytes: Buffer.from('fake-png-bytes'),
    model: 'imagen-3.0-generate-002',
  })),
  generateText: vi.fn(async () => 'mock description'),
}));

vi.mock('../../src/services/storage/storageService.js', () => ({
  getGeneratedImageKey: (projectId: string, imageId: string) =>
    `projects/${projectId}/generated/${imageId}.png`,
  uploadObject: vi.fn(async () => undefined),
  generateThumbnail: vi.fn(async () => undefined),
  getImageUrl: vi.fn(async (key: string) => `https://s3.test/${key}`),
  getThumbnailUrl: vi.fn(async (key: string) => `https://s3.test/${key}?thumb`),
}));

import { app } from '../../src/app.js';
import { getDb } from './setup.js';
import { encryptApiKey } from '../../src/services/encryption/encryptionService.js';
import {
  createTestUser,
  createTestProject,
  createTestAct,
  createTestScene,
  createTestShot,
} from '../fixtures/index.js';

let token: string;
let userId: string;
let projectId: string;
let shotId: string;

async function giveGeminiKey(uid: string): Promise<void> {
  const db = await getDb();
  await db('user_api_keys').insert({
    id: uuid(),
    user_id: uid,
    provider: 'gemini',
    encrypted_key: encryptApiKey('fake-gemini-key'),
    is_valid: true,
  });
}

beforeEach(async () => {
  const db = await getDb();
  const user = await createTestUser(db);
  token = user.token;
  userId = user.userId;
  ({ id: projectId } = await createTestProject(db, userId));
  const { id: actId } = await createTestAct(db, projectId);
  const { id: sceneId } = await createTestScene(db, actId);
  ({ id: shotId } = await createTestShot(db, sceneId));
});

const auth = () => ({ Authorization: `Bearer ${token}` });
const genUrl = () => `/api/projects/${projectId}/shots/${shotId}/generate`;

describe('GET compile-prompt', () => {
  it('returns a compiled prompt for the shot', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}/shots/${shotId}/compile-prompt`)
      .set(auth());
    expect(res.status).toBe(200);
    expect(typeof res.body.prompt).toBe('string');
    expect(res.body.error).toBeNull();
  });
});

describe('POST generate — status machine', () => {
  it('generates an image and moves the shot to GENERATED', async () => {
    await giveGeminiKey(userId);

    const res = await request(app)
      .post(genUrl())
      .set(auth())
      .send({ editedPrompt: 'a lone lighthouse at dusk' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('GENERATED');
    expect(res.body.imageUrl).toContain('https://s3.test/');

    const db = await getDb();
    const shot = await db('shots').where({ id: shotId }).first();
    expect(shot.status).toBe('GENERATED');
    expect(shot.generated_image_id).toBeTruthy();
  });

  it('rejects generation while already GENERATING (409)', async () => {
    await giveGeminiKey(userId);
    const db = await getDb();
    await db('shots').where({ id: shotId }).update({ status: 'GENERATING' });

    const res = await request(app)
      .post(genUrl())
      .set(auth())
      .send({ editedPrompt: 'anything' });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('GEN_ALREADY_IN_PROGRESS');
  });

  it('rejects generation with no configured API key (422)', async () => {
    const res = await request(app)
      .post(genUrl())
      .set(auth())
      .send({ editedPrompt: 'anything' });

    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('KEY_NOT_CONFIGURED');

    // A provider/key failure must leave the shot FAILED, never stuck GENERATING.
    const db = await getDb();
    const shot = await db('shots').where({ id: shotId }).first();
    expect(shot.status).not.toBe('GENERATING');
  });
});

describe('POST revert', () => {
  it('errors when there is no previous image (422)', async () => {
    await giveGeminiKey(userId);
    await request(app)
      .post(genUrl())
      .set(auth())
      .send({ editedPrompt: 'first image' });

    const res = await request(app)
      .post(`/api/projects/${projectId}/shots/${shotId}/revert`)
      .set(auth());
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('GEN_NO_PREVIOUS_IMAGE');
  });

  it('swaps to the previous image after a second generation', async () => {
    await giveGeminiKey(userId);
    const db = await getDb();

    await request(app).post(genUrl()).set(auth()).send({ editedPrompt: 'v1' });
    const afterFirst = await db('shots').where({ id: shotId }).first();
    const firstImageId = afterFirst.generated_image_id;

    await request(app).post(genUrl()).set(auth()).send({ editedPrompt: 'v2' });
    const afterSecond = await db('shots').where({ id: shotId }).first();
    expect(afterSecond.previous_image_id).toBe(firstImageId);

    const res = await request(app)
      .post(`/api/projects/${projectId}/shots/${shotId}/revert`)
      .set(auth());
    expect(res.status).toBe(200);

    const afterRevert = await db('shots').where({ id: shotId }).first();
    expect(afterRevert.generated_image_id).toBe(firstImageId);
  });
});
