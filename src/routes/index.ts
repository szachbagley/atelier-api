import { Router } from 'express';
import { authRouter } from './auth.js';
import { userSettingsRouter } from './userSettings.js';

// Master API router. Mounted at /api by the Express app. Feature routers are
// mounted here as later phases add them (projects, components, storyboard, …).
export const apiRouter = Router();

apiRouter.use('/auth', authRouter);
apiRouter.use('/user', userSettingsRouter);
