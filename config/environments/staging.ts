import type { EnvConfig } from '../../src/types/config.types';

export const stagingConfig: EnvConfig = {
  environment: 'staging',
  baseUrl: 'https://api.realworld.show/api',
  timeouts: { http: 30_000 },
  arrival: { iterationsPerSecond: 50, maxVus: 400 },
  tags: { env: 'staging', app: 'conduit' },
  allowsWrites: false,
};
