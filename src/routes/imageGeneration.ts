import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { generateImageSchema } from '../schemas/shot.js';
import * as imageGeneration from '../services/imageGeneration/index.js';
import { sanitizeForPrompt } from '../services/promptCompiler/index.js';
import { projectIdOf } from './componentHelpers.js';

// Mounted at /projects/:projectId/generate-image — free-form generation for
// the concept art phase (not tied to a shot).
export const imageGenerationRouter = Router({ mergeParams: true });

imageGenerationRouter.use(authenticate, requireProjectAccess);

imageGenerationRouter.post('/', validate(generateImageSchema), async (req, res) => {
  const { prompt } = req.body as { prompt: string };
  const userId = (req.user as { id: string }).id;

  const result = await imageGeneration.generateFromPrompt(
    userId,
    projectIdOf(req),
    sanitizeForPrompt(prompt)
  );

  res.json({
    id: result.id,
    url: result.url,
    prompt: result.prompt,
    provider: result.provider,
    model: result.model,
  });
});
