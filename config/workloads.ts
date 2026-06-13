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

/**
 * Resolves bounded workload controls from environment variables and target defaults.
 * @returns Validated workload profile.
 * @throws When a numeric workload override is not positive.
 */
export function getWorkloadProfile(): WorkloadProfile {
  const config = getConfig();
  return {
    validation: __ENV.TEST_PROFILE === 'validation',
    targetRps: positiveNumber('TARGET_RPS', config.rps.target),
    maxVus: positiveNumber('MAX_VUS', config.rps.max),
    thinkTimeSeconds: positiveNumber('THINK_TIME_SECONDS', 1),
  };
}

/**
 * Builds a ramping-VU scenario.
 * @param stages VU targets and durations.
 * @param gracefulStop Grace period for interrupted iterations.
 * @returns A k6 ramping-vus scenario.
 */
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

/**
 * Builds a fixed per-VU iteration scenario.
 * @param vus Number of virtual users.
 * @param iterations Iterations per virtual user.
 * @param maxDuration Maximum scenario duration.
 * @param gracefulStop Grace period for interrupted iterations.
 * @returns A k6 per-vu-iterations scenario.
 */
export function perVuIterations(
  vus: number,
  iterations: number,
  maxDuration: string,
  gracefulStop = '10s',
): WorkloadScenario {
  return { executor: 'per-vu-iterations', vus, iterations, maxDuration, gracefulStop };
}

/**
 * Builds a bounded constant-arrival-rate scenario.
 * @param profile Resolved workload limits.
 * @param duration Scenario duration.
 * @returns A k6 constant-arrival-rate scenario.
 */
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
