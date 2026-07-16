import { Router } from 'express';
import * as actRepository from '../db/repositories/actRepository.js';
import * as sceneRepository from '../db/repositories/sceneRepository.js';
import { NotFoundError, ValidationError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createSceneSchema,
  moveSceneSchema,
  reorderSchema,
  updateSceneSchema,
} from '../schemas/scene.js';
import { projectIdOf } from './componentHelpers.js';
import { assertComponentRefsInProject } from './storyboardHelpers.js';

// --- Act-scoped routes: /projects/:projectId/acts/:actId/scenes ---

export const actScenesRouter = Router({ mergeParams: true });

actScenesRouter.use(authenticate, requireProjectAccess);

// Verify the act belongs to the project before any scene operation.
actScenesRouter.use(async (req, _res, next) => {
  const { actId } = req.params as { actId: string };
  const act = await actRepository.findById(projectIdOf(req), actId);
  if (!act) throw new NotFoundError('Act', actId);
  next();
});

const actIdOf = (req: { params: unknown }): string =>
  (req.params as { actId: string }).actId;

actScenesRouter.get('/', async (req, res) => {
  res.json({ data: await sceneRepository.listByAct(actIdOf(req)) });
});

actScenesRouter.post('/', validate(createSceneSchema), async (req, res) => {
  const data = req.body as {
    title: string;
    defaultSettingId?: string | null;
    defaultLightingId?: string | null;
  };
  await assertComponentRefsInProject(projectIdOf(req), data);

  const scene = await sceneRepository.create(actIdOf(req), data);
  res.status(201).json(scene);
});

actScenesRouter.post('/reorder', validate(reorderSchema), async (req, res) => {
  const { orderedIds } = req.body as { orderedIds: string[] };
  const updated = await sceneRepository.reorder(actIdOf(req), orderedIds);
  if (updated === null) {
    throw new ValidationError(
      'orderedIds must contain exactly the ids of all active scenes in the act'
    );
  }
  res.json({ updated });
});

// --- Scene-id routes: /projects/:projectId/scenes ---

export const scenesRouter = Router({ mergeParams: true });

scenesRouter.use(authenticate, requireProjectAccess);

async function loadScene(
  req: Parameters<typeof projectIdOf>[0] & { params: unknown }
): Promise<sceneRepository.SceneRecord> {
  const { sceneId } = req.params as { sceneId: string };
  const scene = await sceneRepository.findInProject(projectIdOf(req), sceneId);
  if (!scene) throw new NotFoundError('Scene', sceneId);
  return scene;
}

scenesRouter.get('/:sceneId', async (req, res) => {
  res.json(await loadScene(req));
});

scenesRouter.patch(
  '/:sceneId',
  validate(updateSceneSchema),
  async (req, res) => {
    const scene = await loadScene(req);
    const data = req.body as sceneRepository.UpdateSceneData;
    await assertComponentRefsInProject(projectIdOf(req), data);

    res.json(await sceneRepository.update(scene.id, data));
  }
);

scenesRouter.delete('/:sceneId', async (req, res) => {
  const scene = await loadScene(req);
  await sceneRepository.remove(scene.id);
  res.status(204).send();
});

scenesRouter.post(
  '/:sceneId/move',
  validate(moveSceneSchema),
  async (req, res) => {
    const scene = await loadScene(req);
    const { targetActId } = req.body as { targetActId: string };

    const targetAct = await actRepository.findById(
      projectIdOf(req),
      targetActId
    );
    if (!targetAct) {
      throw new ValidationError('targetActId not found in project', {
        fields: [{ field: 'targetActId', message: `Unknown id: ${targetActId}` }],
      });
    }

    res.json(await sceneRepository.move(scene.id, targetActId));
  }
);
