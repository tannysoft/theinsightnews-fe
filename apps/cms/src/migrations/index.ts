import * as migration_20261103_041109_initial from './20261103_041109_initial';
import * as migration_20261103_045135_users_api_key_access from './20261103_045135_users_api_key_access';
import * as migration_20261103_084832_image_recoveries from './20261103_084832_image_recoveries';

export const migrations = [
  {
    up: migration_20261103_041109_initial.up,
    down: migration_20261103_041109_initial.down,
    name: '20261103_041109_initial',
  },
  {
    up: migration_20261103_045135_users_api_key_access.up,
    down: migration_20261103_045135_users_api_key_access.down,
    name: '20261103_045135_users_api_key_access',
  },
  {
    up: migration_20261103_084832_image_recoveries.up,
    down: migration_20261103_084832_image_recoveries.down,
    name: '20261103_084832_image_recoveries'
  },
];
