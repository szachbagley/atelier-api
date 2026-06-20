import { Router } from 'express';
import { v4 as uuid } from 'uuid';
import { db } from '../db/index.js';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/codes.js';
import { ApiKeyError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { validate, validateParams } from '../middleware/validate.js';
import {
  addApiKeySchema,
  providerParamSchema,
} from '../schemas/userSettings.js';
import {
  decryptApiKey,
  encryptApiKey,
  generateKeyHint,
} from '../services/encryption/encryptionService.js';
import type { ApiKeyProvider, UserApiKey } from '../types/models.js';
import { logger } from '../utils/logger.js';
import { softDelete } from '../utils/softDelete.js';

export const userSettingsRouter = Router();

// Every route here is for the authenticated user only.
userSettingsRouter.use(authenticate);

// Gemini's lightweight, unauthenticated-shape model listing endpoint. A valid
// key returns 200; a rejected key returns 4xx. Interim only — Phase 10 will
// centralise provider calls in the image-generation layer.
const GEMINI_MODELS_URL =
  'https://generativelanguage.googleapis.com/v1beta/models';
const VALIDATION_TIMEOUT_MS = 5000;

function authUserId(req: { user?: { id: string } }): string {
  // authenticate middleware guarantees req.user is set.
  return (req.user as { id: string }).id;
}

userSettingsRouter.get('/api-keys', async (req, res) => {
  const userId = authUserId(req);

  const rows = await db<UserApiKey>('user_api_keys')
    .where({ user_id: userId })
    .whereNull('deleted_at')
    .orderBy('provider');

  res.json({
    apiKeys: rows.map((row) => ({
      provider: row.provider,
      keyHint: row.key_hint,
      isValid: Boolean(row.is_valid),
      updatedAt: row.updated_at,
    })),
  });
});

userSettingsRouter.post('/api-keys', validate(addApiKeySchema), async (req, res) => {
  const userId = authUserId(req);
  const { provider, apiKey } = req.body as {
    provider: ApiKeyProvider;
    apiKey: string;
  };

  const encryptedKey = encryptApiKey(apiKey);
  const keyHint = generateKeyHint(apiKey);

  // The (user_id, provider) unique constraint ignores deleted_at, so an upsert
  // must match any existing row — including a previously soft-deleted one —
  // rather than blindly inserting.
  const existing = await db<UserApiKey>('user_api_keys')
    .where({ user_id: userId, provider })
    .first();

  if (existing) {
    await db('user_api_keys').where({ id: existing.id }).update({
      encrypted_key: encryptedKey,
      key_hint: keyHint,
      is_valid: true,
      deleted_at: null,
      updated_at: db.fn.now(),
    });
  } else {
    await db('user_api_keys').insert({
      id: uuid(),
      user_id: userId,
      provider,
      encrypted_key: encryptedKey,
      key_hint: keyHint,
      is_valid: true,
    });
  }

  res.json({ provider, keyHint, isValid: true });
});

userSettingsRouter.delete(
  '/api-keys/:provider',
  validateParams(providerParamSchema),
  async (req, res) => {
    const userId = authUserId(req);
    const { provider } = req.params as { provider: ApiKeyProvider };

    const existing = await db<UserApiKey>('user_api_keys')
      .where({ user_id: userId, provider })
      .whereNull('deleted_at')
      .first();

    if (existing) {
      await softDelete(db, 'user_api_keys', existing.id);
    }

    res.status(204).send();
  }
);

userSettingsRouter.post(
  '/api-keys/:provider/validate',
  validateParams(providerParamSchema),
  async (req, res) => {
    const userId = authUserId(req);
    const { provider } = req.params as { provider: ApiKeyProvider };

    const existing = await db<UserApiKey>('user_api_keys')
      .where({ user_id: userId, provider })
      .whereNull('deleted_at')
      .first();

    if (!existing) {
      throw new ApiKeyError(
        ErrorCodes.KEY_NOT_CONFIGURED,
        provider,
        'No API key configured for this provider'
      );
    }

    let apiKey: string;
    try {
      apiKey = decryptApiKey(existing.encrypted_key);
    } catch {
      throw new AppError(
        ErrorCodes.KEY_DECRYPTION_FAILED,
        500,
        'Failed to decrypt stored API key',
        { provider }
      );
    }

    const isValid = await validateGeminiKey(apiKey);

    await db('user_api_keys').where({ id: existing.id }).update({
      is_valid: isValid,
      updated_at: db.fn.now(),
    });

    res.json({ isValid });
  }
);

/**
 * Lightweight validity check for a Gemini API key. Returns true if the provider
 * accepts the key, false if it rejects it. Throws when the provider is
 * unreachable so a transient outage is not mistaken for an invalid key.
 */
async function validateGeminiKey(apiKey: string): Promise<boolean> {
  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_MODELS_URL}?key=${encodeURIComponent(apiKey)}`,
      { method: 'GET', signal: AbortSignal.timeout(VALIDATION_TIMEOUT_MS) }
    );
  } catch (err) {
    // Never log the key or the URL containing it.
    logger.warn({ err }, 'Gemini key validation request failed');
    throw new AppError(
      ErrorCodes.SYS_SERVICE_UNAVAILABLE,
      503,
      'Could not reach the provider to validate the key'
    );
  }

  if (response.ok) {
    return true;
  }

  // Provider explicitly rejected the credentials.
  if ([400, 401, 403].includes(response.status)) {
    return false;
  }

  throw new AppError(
    ErrorCodes.SYS_SERVICE_UNAVAILABLE,
    503,
    'Provider returned an unexpected response while validating the key'
  );
}
