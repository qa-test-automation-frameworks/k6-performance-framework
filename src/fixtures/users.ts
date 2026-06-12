import type { RegisterRequest } from '../types';
import { uniqueSuffix } from '../helpers';

export function userFixture(): RegisterRequest {
  const suffix = uniqueSuffix();
  return {
    username: `perf_${suffix}`.replace(/[^a-zA-Z0-9_]/g, '_'),
    email: `perf_${suffix}@example.test`,
    password: `Perf-${suffix}`,
  };
}
