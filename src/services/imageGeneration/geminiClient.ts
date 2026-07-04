import {
  contentFilteredError,
  mapGeminiFetchError,
  mapGeminiHttpError,
} from './errorMapper.js';

// Thin fetch wrapper around the Gemini REST API. The user's own API key is
// passed per-call (decrypted just-in-time); nothing here logs or stores it.

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export const IMAGE_MODEL = 'imagen-3.0-generate-002';
export const TEXT_MODEL = 'gemini-2.5-flash';

const IMAGE_TIMEOUT_MS = 60_000;
const TEXT_TIMEOUT_MS = 30_000;

export interface GeneratedImageResult {
  imageBytes: Buffer;
  model: string;
}

export async function generateImage(
  apiKey: string,
  prompt: string,
  aspectRatio: '16:9' | '1:1' = '16:9'
): Promise<GeneratedImageResult> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${IMAGE_MODEL}:predict`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        instances: [{ prompt }],
        parameters: { sampleCount: 1, aspectRatio },
      }),
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapGeminiFetchError(err);
  }

  if (!response.ok) {
    throw mapGeminiHttpError(response.status, await response.text());
  }

  const body = (await response.json()) as {
    predictions?: Array<{
      bytesBase64Encoded?: string;
      raiFilteredReason?: string;
    }>;
  };

  const prediction = body.predictions?.[0];
  if (prediction?.raiFilteredReason) {
    throw contentFilteredError(prediction.raiFilteredReason);
  }
  if (!prediction?.bytesBase64Encoded) {
    throw contentFilteredError('no image returned');
  }

  return {
    imageBytes: Buffer.from(prediction.bytesBase64Encoded, 'base64'),
    model: IMAGE_MODEL,
  };
}

export async function generateText(
  apiKey: string,
  prompt: string
): Promise<string> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}/${TEXT_MODEL}:generateContent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': apiKey,
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
      }),
      signal: AbortSignal.timeout(TEXT_TIMEOUT_MS),
    });
  } catch (err) {
    throw mapGeminiFetchError(err);
  }

  if (!response.ok) {
    throw mapGeminiHttpError(response.status, await response.text());
  }

  const body = (await response.json()) as {
    promptFeedback?: { blockReason?: string };
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  if (body.promptFeedback?.blockReason) {
    throw contentFilteredError(body.promptFeedback.blockReason);
  }

  const text = body.candidates?.[0]?.content?.parts
    ?.map((part) => part.text ?? '')
    .join('')
    .trim();
  if (!text) {
    throw contentFilteredError('no text returned');
  }

  return text;
}
