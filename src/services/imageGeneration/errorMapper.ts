import { AppError } from '../../errors/AppError.js';
import { ErrorCodes } from '../../errors/codes.js';
import { ApiKeyError, GenerationError } from '../../errors/index.js';

// Maps Gemini API failures to application error codes (docs/API.md):
//   invalid key → KEY_INVALID (422), rate limited → KEY_RATE_LIMITED (429),
//   content filtered → GEN_CONTENT_FILTERED (422), timeout →
//   GEN_PROVIDER_TIMEOUT (504), anything else → GEN_PROVIDER_ERROR (502).

export function mapGeminiHttpError(status: number, bodyText: string): AppError {
  if (status === 400 && /api key not valid|api_key_invalid/i.test(bodyText)) {
    return new ApiKeyError(
      ErrorCodes.KEY_INVALID,
      'gemini',
      'Gemini rejected the configured API key'
    );
  }
  if (status === 401 || status === 403) {
    return new ApiKeyError(
      ErrorCodes.KEY_INVALID,
      'gemini',
      'Gemini rejected the configured API key'
    );
  }
  if (status === 429) {
    return new AppError(
      ErrorCodes.KEY_RATE_LIMITED,
      429,
      'Gemini rate limit exceeded — try again shortly'
    );
  }
  if (/safety|blocked|prohibited/i.test(bodyText)) {
    return new GenerationError(
      ErrorCodes.GEN_CONTENT_FILTERED,
      'The prompt was blocked by Gemini safety filters — adjust the prompt and retry'
    );
  }
  return new AppError(
    ErrorCodes.GEN_PROVIDER_ERROR,
    502,
    `Gemini returned an error (HTTP ${status})`
  );
}

export function mapGeminiFetchError(err: unknown): AppError {
  if (err instanceof AppError) return err;

  if (
    err instanceof Error &&
    (err.name === 'TimeoutError' || err.name === 'AbortError')
  ) {
    return new AppError(
      ErrorCodes.GEN_PROVIDER_TIMEOUT,
      504,
      'Gemini request timed out'
    );
  }

  return new AppError(
    ErrorCodes.GEN_PROVIDER_ERROR,
    502,
    'Failed to reach the Gemini API'
  );
}

// Some "successful" responses carry a block reason instead of an image.
export function contentFilteredError(reason: string): AppError {
  return new GenerationError(
    ErrorCodes.GEN_CONTENT_FILTERED,
    `Content blocked by Gemini safety filters (${reason}) — adjust the prompt and retry`
  );
}
