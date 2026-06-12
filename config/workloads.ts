import { getConfig } from '.';
import type { WorkloadProfile, WorkloadScenario } from '../src/types/config.types';

function positiveNumber(name: string, fallback: number): number {
  const raw = __ENV[name];
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${name} must be a positive number`);
  }
  return value;
}

/** Resolves bounded workload controls from environment variables and target defaults. */
export function getWorkloadProfile(): WorkloadProfile {
  const config = getConfig();
  return {
    validation: __ENV.TEST_PROFILE === 'validation',
    targetRps: positiveNumber('TARGET_RPS', config.rps.target),
    maxVus: positiveNumber('MAX_VUS', config.rps.max),
    thinkTimeSeconds: positiveNumber('THINK_TIME_SECONDS', 1),
  };
}

export function rampingVus(
  stages: Array<{ duration: string; target: number }>,
  gracefulStop = '30s',
): WorkloadScenario {
  return {
    executor: 'ramping-vus',
    startVUs: 0,
    stages,
    gracefulRampDown: gracefulStop,
    gracefulStop,
  };
}

export function perVuIterations(
  vus: number,
  iterations: number,
  maxDuration: string,
  gracefulStop = '10s',
): WorkloadScenario {
  return { executor: 'per-vu-iterations', vus, iterations, maxDuration, gracefulStop };
}

export function constantArrivalRate(profile: WorkloadProfile, duration: string): WorkloadScenario {
  return {
    executor: 'constant-arrival-rate',
    rate: profile.targetRps,
    timeUnit: '1s',
    duration,
    preAllocatedVUs: Math.min(20, profile.maxVus),
    maxVUs: profile.maxVus,
    gracefulStop: '30s',
  };
}
