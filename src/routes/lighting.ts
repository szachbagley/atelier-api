import * as lightingRepository from '../db/repositories/lightingRepository.js';
import {
  createLightingSchema,
  updateLightingSchema,
} from '../schemas/lighting.js';
import { makeComponentCrudRouter } from './componentHelpers.js';

// Mounted at /projects/:projectId/lighting.
export const lightingRouter = makeComponentCrudRouter({
  repo: lightingRepository,
  createSchema: createLightingSchema,
  updateSchema: updateLightingSchema,
  resourceName: 'Lighting setup',
});
