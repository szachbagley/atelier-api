import { Router } from 'express';
import * as sceneRepository from '../db/repositories/sceneRepository.js';
import * as shotRepository from '../db/repositories/shotRepository.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createShotSchema,
  moveShotSchema,
  reorderSchema,
  updateShotSchema,
} from '../schemas/shot.js';
import { projectIdOf } from './componentHelpers.js';
import { assertComponentRefsInProject } from './storyboardHelpers.js';

// --- Scene-scoped routes: /projects/:projectId/scenes/:sceneId/shots ---

export const sceneShotsRouter = Router({ mergeParams: true });

sceneShotsRouter.use(authenticate, requireProjectAccess);

// Verify the scene belongs to the project (through an active act) first.
sceneShotsRouter.use(async (req, _res, next) => {
  const { sceneId } = req.params as { sceneId: string };
  const scene = await sceneRepository.findInProject(projectIdOf(req), sceneId);
  if (!scene) throw new NotFoundError('Scene', sceneId);
  next();
});

const sceneIdOf = (req: { params: unknown }): string =>
  (req.params as { sceneId: string }).sceneId;

sceneShotsRouter.get('/', async (req, res) => {
  res.json({ data: await shotRepository.listByScene(sceneIdOf(req)) });
});

sceneShotsRouter.post('/', validate(createShotSchema), async (req, res) => {
  const data = req.body as shotRepository.CreateShotData;
  await assertComponentRefsInProject(projectIdOf(req), data);

  const shot = await shotRepository.create(sceneIdOf(req), data);
  res.status(201).json(shot);
});

sceneShotsRouter.post('/reorder', validate(reorderSchema), async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const updated = await shotRepository.reorder(sceneIdOf(req), orderedIds);
  if (updated === null) {
    throw new ValidationError(
      'orderedIds must contain exactly the ids of all active shots in the scene'
    );
  }
  res.json({ updated });
});

// --- Shot-id routes: /projects/:projectId/shots ---

export const shotsRouter = Router({ mergeParams: true });

shotsRouter.use(authenticate, requireProjectAccess);

async function loadShot(
  req: Parameters<typeof projectIdOf>[0] & { params: unknown }
): Promise<shotRepository.ShotRecord> {
  const { shotId } = req.params as { shotId: string };
  const shot = await shotRepository.findInProject(projectIdOf(req), shotId);
  if (!shot) throw new NotFoundError('Shot', shotId);
  return shot;
}

shotsRouter.get('/:shotId', async (req, res) => {
  const { shotId } = req.params as { shotId: string };
  const detail = await shotRepository.findDetail(projectIdOf(req), shotId);
  if (!detail) throw new NotFoundError('Shot', shotId);
  res.json(detail);
});

shotsRouter.patch('/:shotId', validate(updateShotSchema), async (req, res) => {
  const shot = await loadShot(req);
  const data = req.body as shotRepository.UpdateShotData;
  await assertComponentRefsInProject(projectIdOf(req), data);

  await shotRepository.update(shot.id, data);
  res.json(await shotRepository.findDetail(projectIdOf(req), shot.id));
});

shotsRouter.delete('/:shotId', async (req, res) => {
  const shot = await loadShot(req);
  await shotRepository.remove(shot.id);
  res.status(204).send();
});

shotsRouter.post(
  '/:shotId/move',
  validate(moveShotSchema),
  async (req, res) => {
    const shot = await loadShot(req);
    const { targetSceneId } = req.body as { targetSceneId: string };

    const targetScene = await sceneRepository.findInProject(
      projectIdOf(req),
      targetSceneId
    );
    if (!targetScene) {
      throw new ValidationError('targetSceneId not found in project', {
        fields: [
          { field: 'targetSceneId', message: `Unknown id: ${targetSceneId}` },
        ],
      });
    }

    res.json(await shotRepository.move(shot.id, targetSceneId));
  }
);
