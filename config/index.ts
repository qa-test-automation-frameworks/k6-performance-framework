import { localConfig } from './environments/local';
import { productionConfig } from './environments/production';
import { stagingConfig } from './environments/staging';
import type { EnvironmentName, EnvConfig } from '../src/types/config.types';

const configs: Record<Exclude<EnvironmentName, 'production'>, EnvConfig> = {
  local: localConfig,
  staging: stagingConfig,
};

/**
 * Resolves and validates the selected target environment at k6 initialization time.
 * @param env Target environment name.
 * @returns Validated environment configuration.
 * @throws When the environment name is unknown or required production settings are absent.
 */
export function getConfig(env: string = __ENV.TARGET_ENV ?? 'local'): EnvConfig {
  if (env === 'production') {
    return {
      ...productionConfig(__ENV.BASE_URL),
      allowsWrites: __ENV.ALLOW_NON_LOCAL_LOAD === 'true',
    };
  }

  if (env === 'local' || env === 'staging') {
    return {
      ...configs[env],
      baseUrl: __ENV.BASE_URL ?? configs[env].baseUrl,
      allowsWrites:
        env === 'staging' ? __ENV.ALLOW_NON_LOCAL_LOAD === 'true' : configs[env].allowsWrites,
    };
  }

  throw new Error(`Unknown TARGET_ENV: "${env}"`);
}
