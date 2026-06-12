import type { EnvConfig } from '../../src/types/config.types';

export const stagingConfig: EnvConfig = {
  environment: 'staging',
  baseUrl: 'https://api.realworld.io/api',
  timeouts: { http: 30_000, connect: 10_000 },
  rps: { target: 50, max: 400 },
  tags: { env: 'staging', app: 'conduit' },
  readOnly: false,
};
