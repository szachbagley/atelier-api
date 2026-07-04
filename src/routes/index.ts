import { Router } from 'express';
import { actsRouter } from './acts.js';
import { artStyleRouter } from './artStyle.js';
import { authRouter } from './auth.js';
import { charactersRouter } from './characters.js';
import { conceptSessionsRouter } from './conceptSessions.js';
import { imageGenerationRouter } from './imageGeneration.js';
import { lightingRouter } from './lighting.js';
import { projectsRouter } from './projects.js';
import { propsRouter } from './props.js';
import { referenceImagesRouter } from './referenceImages.js';
import { actScenesRouter, scenesRouter } from './scenes.js';
import { settingsRouter } from './settings.js';
import { sharedRouter } from './shared.js';
import { sceneShotsRouter, shotsRouter } from './shots.js';
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

// Images.
apiRouter.use('/projects/:projectId/reference-images', referenceImagesRouter);
apiRouter.use('/projects/:projectId/generate-image', imageGenerationRouter);

// Concept art sessions.
apiRouter.use('/projects/:projectId/concept-sessions', conceptSessionsRouter);

// Storyboard structure (acts → scenes → shots).
apiRouter.use('/projects/:projectId/acts/:actId/scenes', actScenesRouter);
apiRouter.use('/projects/:projectId/acts', actsRouter);
apiRouter.use('/projects/:projectId/scenes/:sceneId/shots', sceneShotsRouter);
apiRouter.use('/projects/:projectId/scenes', scenesRouter);
apiRouter.use('/projects/:projectId/shots', shotsRouter);
