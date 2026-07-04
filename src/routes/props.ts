import * as propRepository from '../db/repositories/propRepository.js';
import { createPropSchema, updatePropSchema } from '../schemas/prop.js';
import { makeComponentCrudRouter } from './componentHelpers.js';

// Mounted at /projects/:projectId/props.
export const propsRouter = makeComponentCrudRouter({
  repo: propRepository,
  createSchema: createPropSchema,
  updateSchema: updatePropSchema,
  resourceName: 'Prop',
});
