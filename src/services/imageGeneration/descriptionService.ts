import { db } from '../../db/index.js';
import { ErrorCodes } from '../../errors/codes.js';
import { ApiKeyError } from '../../errors/index.js';
import type { UserApiKey } from '../../types/models.js';
import { decryptApiKey } from '../encryption/encryptionService.js';
import { sanitizeForPrompt } from '../promptCompiler/index.js';
import { generateText } from './geminiClient.js';

// AI-optimized component descriptions (the generate-description endpoints):
// turn a component's human-readable fields into a compact visual description
// ready to drop into an image-generation prompt.

const MAX_DESCRIPTION_LENGTH = 1000;

async function getUserGeminiKey(userId: string): Promise<string> {
  const record = await db<UserApiKey>('user_api_keys')
    .where({ user_id: userId, provider: 'gemini' })
    .whereNull('deleted_at')
    .first();

  if (!record) {
    throw new ApiKeyError(
      ErrorCodes.KEY_NOT_CONFIGURED,
      'gemini',
      'No Gemini API key configured — add one in Settings'
    );
  }

  return decryptApiKey(record.encrypted_key);
}

export async function generateComponentDescription(
  userId: string,
  componentLabel: string,
  fields: Record<string, unknown>
): Promise<string> {
  const apiKey = await getUserGeminiKey(userId);

  const fieldLines = Object.entries(fields)
    .filter(([, value]) => {
      if (value === null || value === undefined) return false;
      if (Array.isArray(value)) return value.length > 0;
      return String(value).trim() !== '';
    })
    .map(([key, value]) => {
      const rendered = Array.isArray(value)
        ? value.map((v) => sanitizeForPrompt(String(v))).join(', ')
        : sanitizeForPrompt(String(value));
      return `${key}: ${rendered}`;
    });

  const prompt = [
    'You are helping build image-generation prompts for film storyboards.',
    `Write a single concise visual description (2-3 sentences) of the following ${componentLabel}, optimized for an AI image generation model.`,
    'Respond with only the description text — no preamble, no quotes.',
    '',
    ...fieldLines,
  ].join('\n');

  const text = await generateText(apiKey, prompt);
  return text.slice(0, MAX_DESCRIPTION_LENGTH);
}
