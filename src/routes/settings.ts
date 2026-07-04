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
  describeLabel: 'film location/setting',
  describeFields: (record) => {
    const s = record as settingRepository.SettingRecord;
    return {
      name: s.name,
      description: s.description,
      setDressing: s.setDressing,
      timeOfDay: s.timeOfDay === 'unspecified' ? null : s.timeOfDay,
      weather: s.weather === 'unspecified' ? null : s.weather,
      lighting: s.lighting,
      mood: s.mood,
    };
  },
});
