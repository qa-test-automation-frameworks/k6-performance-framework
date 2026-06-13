import type { EnvConfig } from '../../src/types/config.types';

/**
 * Creates a read-only production target configuration.
 * @param baseUrl Explicit authorized production URL.
 * @returns Production environment configuration.
 * @throws When no production URL is supplied.
 */
export function productionConfig(baseUrl: string | undefined): EnvConfig {
  if (!baseUrl) {
    throw new Error('BASE_URL is required when TARGET_ENV is "production"');
  }

  return {
    environment: 'production',
    baseUrl,
    timeouts: { http: 30_000 },
    rps: { target: 10, max: 50 },
    tags: { env: 'production', app: 'conduit' },
    allowsWrites: false,
  };
}
