import * as settingRepository from '../db/repositories/settingRepository.js';
import {
  createSettingSchema,
  updateSettingSchema,
} from '../schemas/setting.js';
import { makeComponentCrudRouter } from './componentHelpers.js';

// Mounted at /projects/:projectId/settings.
export const settingsRouter = makeComponentCrudRouter({
  repo: settingRepository,
  createSchema: createSettingSchema,
  updateSchema: updateSettingSchema,
  resourceName: 'Setting',
});
