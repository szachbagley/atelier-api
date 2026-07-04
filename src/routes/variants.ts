import { Router } from 'express';
import * as characterRepository from '../db/repositories/characterRepository.js';
import * as variantRepository from '../db/repositories/variantRepository.js';
import { NotFoundError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createVariantSchema,
  updateVariantSchema,
} from '../schemas/variant.js';
import { generateComponentDescription } from '../services/imageGeneration/descriptionService.js';
import { authUserIdOf, projectIdOf } from './componentHelpers.js';

// Mounted at /projects/:projectId/characters/:characterId/variants.
export const variantsRouter = Router({ mergeParams: true });

variantsRouter.use(authenticate, requireProjectAccess);

// Verify the character belongs to the project before any variant operation.
variantsRouter.use(async (req, _res, next) => {
  const { characterId } = req.params as { characterId: string };
  const character = await characterRepository.findById(
    projectIdOf(req),
    characterId
  );
  if (!character) throw new NotFoundError('Character', characterId);
  next();
});

function characterIdOf(req: { params: unknown }): string {
  return (req.params as { characterId: string }).characterId;
}

variantsRouter.get('/', async (req, res) => {
  res.json({ data: await variantRepository.list(characterIdOf(req)) });
});

variantsRouter.post('/', validate(createVariantSchema), async (req, res) => {
  const variant = await variantRepository.create(
    characterIdOf(req),
    req.body as object
  );
  res.status(201).json(variant);
});

variantsRouter.get('/:variantId', async (req, res) => {
  const { variantId } = req.params as { variantId: string };
  const variant = await variantRepository.findById(
    characterIdOf(req),
    variantId
  );
  if (!variant) throw new NotFoundError('Variant', variantId);
  res.json(variant);
});

variantsRouter.patch(
  '/:variantId',
  validate(updateVariantSchema),
  async (req, res) => {
    const { variantId } = req.params as { variantId: string };
    const existing = await variantRepository.findById(
      characterIdOf(req),
      variantId
    );
    if (!existing) throw new NotFoundError('Variant', variantId);

    res.json(await variantRepository.update(variantId, req.body as object));
  }
);

variantsRouter.delete('/:variantId', async (req, res) => {
  const { variantId } = req.params as { variantId: string };
  const existing = await variantRepository.findById(
    characterIdOf(req),
    variantId
  );
  if (!existing) throw new NotFoundError('Variant', variantId);

  await variantRepository.remove(variantId);
  res.status(204).send();
});

// Combined base character + variant description (per docs/API.md).
variantsRouter.post('/:variantId/generate-description', async (req, res) => {
  const { variantId } = req.params as { variantId: string };
  const variant = await variantRepository.findById(
    characterIdOf(req),
    variantId
  );
  if (!variant) throw new NotFoundError('Variant', variantId);

  const character = await characterRepository.findById(
    projectIdOf(req),
    characterIdOf(req)
  );

  const aiDescription = await generateComponentDescription(
    authUserIdOf(req),
    'film character variant (base character plus this variant appearance)',
    {
      characterName: character?.name,
      physicalDescription: character?.physicalDescription,
      personality: character?.personality,
      variantName: variant.name,
      variantDescription: variant.description,
    }
  );
  res.json({ aiDescription });
});
