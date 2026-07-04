import { Router } from 'express';
import * as characterRepository from '../db/repositories/characterRepository.js';
import { NotFoundError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createCharacterSchema,
  updateCharacterSchema,
} from '../schemas/character.js';
import {
  generateDescriptionStub,
  projectIdOf,
} from './componentHelpers.js';

// Mounted at /projects/:projectId/characters.
export const charactersRouter = Router({ mergeParams: true });

charactersRouter.use(authenticate, requireProjectAccess);

charactersRouter.get('/', async (req, res) => {
  res.json({ data: await characterRepository.list(projectIdOf(req)) });
});

charactersRouter.post('/', validate(createCharacterSchema), async (req, res) => {
  const character = await characterRepository.create(
    projectIdOf(req),
    req.body as object
  );
  res.status(201).json(character);
});

charactersRouter.get('/:characterId', async (req, res) => {
  const { characterId } = req.params as { characterId: string };
  const detail = await characterRepository.findDetail(
    projectIdOf(req),
    characterId
  );
  if (!detail) throw new NotFoundError('Character', characterId);
  res.json(detail);
});

charactersRouter.patch(
  '/:characterId',
  validate(updateCharacterSchema),
  async (req, res) => {
    const { characterId } = req.params as { characterId: string };
    const existing = await characterRepository.findById(
      projectIdOf(req),
      characterId
    );
    if (!existing) throw new NotFoundError('Character', characterId);

    res.json(await characterRepository.update(characterId, req.body as object));
  }
);

charactersRouter.delete('/:characterId', async (req, res) => {
  const { characterId } = req.params as { characterId: string };
  const existing = await characterRepository.findById(
    projectIdOf(req),
    characterId
  );
  if (!existing) throw new NotFoundError('Character', characterId);

  await characterRepository.remove(characterId);
  res.status(204).send();
});

charactersRouter.post(
  '/:characterId/generate-description',
  generateDescriptionStub
);
