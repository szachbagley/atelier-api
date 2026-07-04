import { Router } from 'express';
import type { Schema } from 'joi';
import { NotFoundError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import { generateComponentDescription } from '../services/imageGeneration/descriptionService.js';
import type { Project } from '../types/models.js';

export function authUserIdOf(req: { user?: { id: string } }): string {
  // authenticate middleware guarantees req.user is set.
  return (req.user as { id: string }).id;
}

export function projectIdOf(req: { project?: Project }): string {
  // requireProjectAccess middleware guarantees req.project is set.
  return (req.project as Project).id;
}

interface ComponentRepo {
  list(projectId: string): Promise<object[]>;
  findById(projectId: string, id: string): Promise<object | null>;
  create(projectId: string, data: object): Promise<object>;
  update(id: string, data: object): Promise<object>;
  remove(id: string): Promise<void>;
}

// Standard router for flat project-scoped components (settings, props,
// lighting): list / create / get / patch / delete / generate-description.
// Characters and variants have bespoke routers (relations, nesting).
// `describeFields` picks the human-readable fields sent to Gemini for
// generate-description; `describeLabel` names the component in the prompt.
export function makeComponentCrudRouter(options: {
  repo: ComponentRepo;
  createSchema: Schema;
  updateSchema: Schema;
  resourceName: string;
  describeLabel: string;
  describeFields: (record: object) => Record<string, unknown>;
}): Router {
  const {
    repo,
    createSchema,
    updateSchema,
    resourceName,
    describeLabel,
    describeFields,
  } = options;
  const router = Router({ mergeParams: true });

  router.use(authenticate, requireProjectAccess);

  const idOf = (req: { params: unknown }): string =>
    (req.params as { id: string }).id;

  router.get('/', async (req, res) => {
    res.json({ data: await repo.list(projectIdOf(req)) });
  });

  router.post('/', validate(createSchema), async (req, res) => {
    const created = await repo.create(projectIdOf(req), req.body as object);
    res.status(201).json(created);
  });

  router.get('/:id', async (req, res) => {
    const record = await repo.findById(projectIdOf(req), idOf(req));
    if (!record) throw new NotFoundError(resourceName, idOf(req));
    res.json(record);
  });

  router.patch('/:id', validate(updateSchema), async (req, res) => {
    const existing = await repo.findById(projectIdOf(req), idOf(req));
    if (!existing) throw new NotFoundError(resourceName, idOf(req));
    res.json(await repo.update(idOf(req), req.body as object));
  });

  router.delete('/:id', async (req, res) => {
    const existing = await repo.findById(projectIdOf(req), idOf(req));
    if (!existing) throw new NotFoundError(resourceName, idOf(req));
    await repo.remove(idOf(req));
    res.status(204).send();
  });

  router.post('/:id/generate-description', async (req, res) => {
    const record = await repo.findById(projectIdOf(req), idOf(req));
    if (!record) throw new NotFoundError(resourceName, idOf(req));

    const aiDescription = await generateComponentDescription(
      authUserIdOf(req),
      describeLabel,
      describeFields(record)
    );
    res.json({ aiDescription });
  });

  return router;
}
