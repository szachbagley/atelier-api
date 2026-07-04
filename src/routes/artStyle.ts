import { Router } from 'express';
import * as artStyleRepository from '../db/repositories/artStyleRepository.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { updateArtStyleSchema } from '../schemas/artStyle.js';
import {
  generateDescriptionStub,
  projectIdOf,
} from './componentHelpers.js';

// Mounted at /projects/:projectId/art-style — one art style per project.
export const artStyleRouter = Router({ mergeParams: true });

artStyleRouter.use(authenticate, requireProjectAccess);

artStyleRouter.get('/', async (req, res) => {
  // The row is created with the project; upsert() also recreates it if lost.
  const artStyle = await artStyleRepository.get(projectIdOf(req));
  res.json(artStyle ?? (await artStyleRepository.upsert(projectIdOf(req), {})));
});

artStyleRouter.put('/', validate(updateArtStyleSchema), async (req, res) => {
  const updated = await artStyleRepository.upsert(
    projectIdOf(req),
    req.body as object
  );
  res.json(updated);
});

artStyleRouter.post('/generate-description', generateDescriptionStub);
