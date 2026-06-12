import { getConfig } from '.';
import type { WorkloadProfile } from '../src/types/config.types';

function positiveNumber(name: string, fallback: number): number {
  const raw = __ENV[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

export function getWorkloadProfile(): WorkloadProfile {
  const config = getConfig();
  return {
    validation: __ENV.TEST_PROFILE === 'validation',
    targetRps: positiveNumber('TARGET_RPS', config.rps.target),
    maxVus: positiveNumber('MAX_VUS', config.rps.max),
    thinkTimeSeconds: positiveNumber('THINK_TIME_SECONDS', 1),
  };
}
