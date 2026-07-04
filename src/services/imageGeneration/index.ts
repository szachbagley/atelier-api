import { v4 as uuid } from 'uuid';
import { db } from '../../db/index.js';
import * as generatedImageRepository from '../../db/repositories/generatedImageRepository.js';
import { ErrorCodes } from '../../errors/codes.js';
import { ApiKeyError, GenerationError } from '../../errors/index.js';
import type { Shot, UserApiKey } from '../../types/models.js';
import { logger } from '../../utils/logger.js';
import { decryptApiKey } from '../encryption/encryptionService.js';
import { buildShotContext, getPromptCompiler } from '../promptCompiler/index.js';
import * as storage from '../storage/storageService.js';
import { generateImage, IMAGE_MODEL } from './geminiClient.js';

const PROVIDER = 'gemini';

export interface GenerationResult {
  id: string;
  url: string;
  thumbnailUrl: string;
  prompt: string;
  provider: string;
  model: string;
  s3Key: string;
}

// Decrypt the user's Gemini key just-in-time; never logged or persisted in
// plaintext.
async function getUserGeminiKey(userId: string): Promise<string> {
  const record = await db<UserApiKey>('user_api_keys')
    .where({ user_id: userId, provider: PROVIDER })
    .whereNull('deleted_at')
    .first();

  if (!record) {
    throw new ApiKeyError(
      ErrorCodes.KEY_NOT_CONFIGURED,
      PROVIDER,
      'No Gemini API key configured — add one in Settings'
    );
  }

  return decryptApiKey(record.encrypted_key);
}

// Free-form generation (concept art phase and the storyboard pipeline both
// funnel through here): Gemini → S3 → thumbnail → generated_images record.
export async function generateFromPrompt(
  userId: string,
  projectId: string,
  prompt: string
): Promise<GenerationResult> {
  const apiKey = await getUserGeminiKey(userId);

  const { imageBytes, model } = await generateImage(apiKey, prompt);

  const imageId = uuid();
  const s3Key = storage.getGeneratedImageKey(projectId, imageId);
  await storage.uploadObject(s3Key, imageBytes, 'image/png');

  try {
    await storage.generateThumbnail(imageBytes, s3Key);
  } catch (err) {
    logger.warn({ err, s3Key }, 'generated image thumbnail failed');
  }

  const id = await generatedImageRepository.create(projectId, {
    s3Key,
    prompt,
    provider: PROVIDER,
    model,
  });

  return {
    id,
    url: await storage.getImageUrl(s3Key),
    thumbnailUrl: await storage.getThumbnailUrl(s3Key),
    prompt,
    provider: PROVIDER,
    model,
    s3Key,
  };
}

export interface ShotGenerationResult extends GenerationResult {
  shotId: string;
  status: 'GENERATED';
}

// Storyboard generation with the DRAFT → GENERATING → GENERATED/FAILED
// status machine and previous-image tracking for revert.
export async function generateForShot(
  userId: string,
  projectId: string,
  shotId: string,
  editedPrompt?: string
): Promise<ShotGenerationResult> {
  const shot = (await db<Shot>('shots').where({ id: shotId }).first()) as Shot;

  if (shot.status === 'GENERATING') {
    throw new GenerationError(
      ErrorCodes.GEN_ALREADY_IN_PROGRESS,
      'This shot is already generating an image',
      undefined
    );
  }

  // Resolve the prompt before flipping status so validation failures do not
  // leave the shot GENERATING.
  let prompt: string;
  if (editedPrompt) {
    prompt = editedPrompt;
  } else {
    const context = await buildShotContext(projectId, shotId);
    if (!context) {
      throw new GenerationError(
        ErrorCodes.GEN_PROVIDER_ERROR,
        'Shot context could not be loaded'
      );
    }
    const compiled = getPromptCompiler(PROVIDER).compile(context);
    if (compiled.error) {
      throw new GenerationError(
        ErrorCodes.GEN_PROMPT_TOO_LONG,
        compiled.error.message
      );
    }
    prompt = compiled.prompt;
  }

  await db('shots')
    .where({ id: shotId })
    .update({ status: 'GENERATING', updated_at: db.fn.now() });

  try {
    const result = await generateFromPrompt(userId, projectId, prompt);

    await db('shots').where({ id: shotId }).update({
      previous_image_id: shot.generated_image_id,
      generated_image_id: result.id,
      compiled_prompt: prompt,
      edited_prompt: editedPrompt ?? null,
      status: 'GENERATED',
      updated_at: db.fn.now(),
    });

    return { ...result, shotId, status: 'GENERATED' };
  } catch (err) {
    await db('shots')
      .where({ id: shotId })
      .update({ status: 'FAILED', updated_at: db.fn.now() });
    throw err;
  }
}

export { IMAGE_MODEL, PROVIDER as GENERATION_PROVIDER };
