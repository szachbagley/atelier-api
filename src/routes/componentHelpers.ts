import type { RequestHandler } from 'express';
import { Router } from 'express';
import type { Schema } from 'joi';
import { AppError } from '../errors/AppError.js';
import { ErrorCodes } from '../errors/codes.js';
import { NotFoundError } from '../errors/index.js';
import { authenticate } from '../middleware/authenticate.js';
import { requireProjectAccess } from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import type { Project } from '../types/models.js';

// Placeholder for the generate-description endpoints created in Phase 7.
// Phase 10 replaces this with real Gemini-backed description generation.
export const generateDescriptionStub: RequestHandler = () => {
  throw new AppError(
    ErrorCodes.SYS_SERVICE_UNAVAILABLE,
    501,
    'AI description generation is not implemented yet'
  );
};

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
export function makeComponentCrudRouter(options: {
  repo: ComponentRepo;
  createSchema: Schema;
  updateSchema: Schema;
  resourceName: string;
}): Router {
  const { repo, createSchema, updateSchema, resourceName } = options;
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

  router.post('/:id/generate-description', generateDescriptionStub);

  return router;
}
