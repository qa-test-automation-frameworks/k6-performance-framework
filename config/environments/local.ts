import type { EnvConfig } from '../../src/types/config.types';

export const localConfig: EnvConfig = {
  environment: 'local',
  baseUrl: 'http://localhost:3000/api',
  timeouts: { http: 30_000 },
  rps: { target: 20, max: 100 },
  tags: { env: 'local', app: 'conduit' },
  allowsWrites: true,
};
