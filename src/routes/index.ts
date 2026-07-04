import { Router } from 'express';
import { artStyleRouter } from './artStyle.js';
import { authRouter } from './auth.js';
import { charactersRouter } from './characters.js';
import { lightingRouter } from './lighting.js';
import { projectsRouter } from './projects.js';
import { propsRouter } from './props.js';
import { settingsRouter } from './settings.js';
import { sharedRouter } from './shared.js';
import { userSettingsRouter } from './userSettings.js';
import { variantsRouter } from './variants.js';

// Master API router. Mounted at /api by the Express app. Feature routers are
// mounted here as later phases add them (storyboard, images, generation, …).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/user', userSettingsRouter);
apiRouter.use('/projects', projectsRouter);
apiRouter.use('/shared', sharedRouter);

// Component library (each router applies authenticate + requireProjectAccess).
apiRouter.use('/projects/:projectId/art-style', artStyleRouter);
apiRouter.use('/projects/:projectId/characters', charactersRouter);
apiRouter.use(
  '/projects/:projectId/characters/:characterId/variants',
  variantsRouter
);
apiRouter.use('/projects/:projectId/settings', settingsRouter);
apiRouter.use('/projects/:projectId/props', propsRouter);
apiRouter.use('/projects/:projectId/lighting', lightingRouter);
