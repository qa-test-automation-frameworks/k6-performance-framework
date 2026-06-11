import type { EnvConfig } from '../../src/types/config.types';

export function productionConfig(baseUrl: string | undefined): EnvConfig {
  if (!baseUrl) {
    throw new Error('BASE_URL is required when TARGET_ENV is "production"');
  }

  return {
    environment: 'production',
    baseUrl,
    timeouts: { http: 30_000, connect: 10_000 },
    rps: { target: 10, max: 50 },
    tags: { env: 'production', app: 'conduit' },
    readOnly: true,
  };
}
