import type { Project } from './models.js';

declare global {
  namespace Express {
    interface Request {
      requestId: string;
      user?: { id: string; email: string };
      project?: Project;
    }
  }
}

export {};
