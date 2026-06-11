import { localConfig } from './environments/local';
import { productionConfig } from './environments/production';
import { stagingConfig } from './environments/staging';
import type { EnvironmentName, EnvConfig } from '../src/types/config.types';

const configs: Record<Exclude<EnvironmentName, 'production'>, EnvConfig> = {
  local: localConfig,
  staging: stagingConfig,
};

export function getConfig(env: string = __ENV.TARGET_ENV ?? 'local'): EnvConfig {
  if (env === 'production') {
    return productionConfig(__ENV.BASE_URL);
  }

  if (env === 'local' || env === 'staging') {
    return {
      ...configs[env],
      baseUrl: __ENV.BASE_URL ?? configs[env].baseUrl,
    };
  }

  throw new Error(`Unknown TARGET_ENV: "${env}"`);
}
