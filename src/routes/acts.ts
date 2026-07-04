import { Router } from 'express';
import * as actRepository from '../db/repositories/actRepository.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createActSchema,
  reorderSchema,
  updateActSchema,
} from '../schemas/act.js';
import { projectIdOf } from './componentHelpers.js';

// Mounted at /projects/:projectId/acts.
export const actsRouter = Router({ mergeParams: true });

actsRouter.use(authenticate, requireProjectAccess);

actsRouter.get('/', async (req, res) => {
  res.json({ data: await actRepository.list(projectIdOf(req)) });
});

actsRouter.post('/', validate(createActSchema), async (req, res) => {
  const { title } = req.body as { title: string };
  const act = await actRepository.create(projectIdOf(req), title);
  res.status(201).json(act);
});

// Registered before /:actId so "reorder" is not captured as an id.
actsRouter.post('/reorder', validate(reorderSchema), async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const updated = await actRepository.reorder(projectIdOf(req), orderedIds);
  if (updated === null) {
    throw new ValidationError(
      'orderedIds must contain exactly the ids of all active acts in the project'
    );
  }
  res.json({ updated });
});

actsRouter.get('/:actId', async (req, res) => {
  const { actId } = req.params as { actId: string };
  const act = await actRepository.findById(projectIdOf(req), actId);
  if (!act) throw new NotFoundError('Act', actId);
  res.json(act);
});

actsRouter.patch('/:actId', validate(updateActSchema), async (req, res) => {
  const { actId } = req.params as { actId: string };
  const existing = await actRepository.findById(projectIdOf(req), actId);
  if (!existing) throw new NotFoundError('Act', actId);

  const { title } = req.body as { title: string };
  res.json(await actRepository.update(actId, title));
});

actsRouter.delete('/:actId', async (req, res) => {
  const { actId } = req.params as { actId: string };
  const existing = await actRepository.findById(projectIdOf(req), actId);
  if (!existing) throw new NotFoundError('Act', actId);

  await actRepository.remove(actId);
  res.status(204).send();
});
