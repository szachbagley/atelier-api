import { Router } from 'express';
import { config } from '../config/index.js';
import * as projectRepository from '../db/repositories/projectRepository.js';
import { authenticate } from '../middleware/authenticate.js';
import {
  requireProjectAccess,
  requireProjectAccessAllowDeleted,
} from '../middleware/authorize.js';
import { validate } from '../middleware/validate.js';
import {
  createProjectSchema,
  updateProjectSchema,
} from '../schemas/project.js';
import type { Project } from '../types/models.js';

export const projectsRouter = Router();

projectsRouter.use(authenticate);

function authUserId(req: { user?: { id: string } }): string {
  // authenticate middleware guarantees req.user is set.
  return (req.user as { id: string }).id;
}

function loadedProject(req: { project?: Project }): Project {
  // requireProjectAccess middleware guarantees req.project is set.
  return req.project as Project;
}

projectsRouter.get('/', async (req, res) => {
  const projects = await projectRepository.findByUserId(authUserId(req));
  res.json({ data: projects });
});

projectsRouter.post('/', validate(createProjectSchema), async (req, res) => {
  const { title } = req.body as { title: string };
  const project = await projectRepository.create(authUserId(req), { title });

  res.status(201).json({
    id: project.id,
    title: project.title,
    isPublic: project.isPublic,
    createdAt: project.createdAt,
  });
});

projectsRouter.get('/:projectId', requireProjectAccess, async (req, res) => {
  // req.project proves access; re-fetch through the repository for the
  // camelCase detail shape with summary aggregates.
  const detail = await projectRepository.findById(loadedProject(req).id);
  res.json(detail);
});

projectsRouter.patch(
  '/:projectId',
  requireProjectAccess,
  validate(updateProjectSchema),
  async (req, res) => {
    const updated = await projectRepository.update(
      loadedProject(req).id,
      req.body as projectRepository.UpdateProjectData
    );

    res.json({
      id: updated.id,
      title: updated.title,
      updatedAt: updated.updatedAt,
    });
  }
);

projectsRouter.delete('/:projectId', requireProjectAccess, async (req, res) => {
  await projectRepository.softDeleteProject(loadedProject(req).id);
  res.status(204).send();
});

projectsRouter.post(
  '/:projectId/restore',
  requireProjectAccessAllowDeleted,
  async (req, res) => {
    const project = loadedProject(req);
    await projectRepository.restoreProject(project.id);

    res.json({
      id: project.id,
      title: project.title,
      deletedAt: null,
    });
  }
);

projectsRouter.post(
  '/:projectId/share',
  requireProjectAccess,
  async (req, res) => {
    const { shareToken } = await projectRepository.setShareToken(
      loadedProject(req).id
    );

    res.json({
      shareToken,
      shareUrl: `${config.app.publicUrl}/shared/${shareToken}`,
      isPublic: true,
    });
  }
);

projectsRouter.delete(
  '/:projectId/share',
  requireProjectAccess,
  async (req, res) => {
    await projectRepository.revokeShare(loadedProject(req).id);

    res.json({
      isPublic: false,
      shareToken: null,
    });
  }
);
