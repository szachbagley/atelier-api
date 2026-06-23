import type { NextFunction, Request, Response } from 'express';
import { db } from '../db/index.js';
import { ErrorCodes } from '../errors/codes.js';
import { ForbiddenError } from '../errors/index.js';
import type { Project } from '../types/models.js';
import { addActiveFilter } from '../utils/softDelete.js';

// Loads the project named in the URL, verifying the authenticated user owns it,
// and attaches it to req.project for downstream handlers. `authenticate` must
// run earlier in the chain so req.user is populated.
async function attachProject(req: Request, allowDeleted: boolean): Promise<void> {
  const { projectId } = req.params as { projectId: string };
  const userId = (req.user as { id: string }).id;

  const base = db<Project>('projects').where({
    id: projectId,
    user_id: userId,
  });
  const project = await (allowDeleted ? base : addActiveFilter(base)).first();

  if (!project) {
    // 403 (not 404) per docs/API.md; ownership failures and unknown IDs are
    // intentionally indistinguishable.
    throw new ForbiddenError('project', ErrorCodes.AUTHZ_PROJECT_ACCESS_DENIED);
  }

  req.project = project;
}

/**
 * Require that the authenticated user owns the active (non-deleted) project in
 * the URL. The common gate for all /projects/:projectId routes.
 */
export async function requireProjectAccess(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  await attachProject(req, false);
  next();
}

/**
 * Variant that also matches soft-deleted projects — used by the restore route,
 * which by definition operates on a deleted project.
 */
export async function requireProjectAccessAllowDeleted(
  req: Request,
  _res: Response,
  next: NextFunction
): Promise<void> {
  await attachProject(req, true);
  next();
}
