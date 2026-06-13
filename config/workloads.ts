import { getConfig } from '.';
import type {
  EnvironmentName,
  StagedWorkload,
  WorkloadProfile,
  WorkloadScenario,
  WorkloadStage,
} from '../src/types/config.types';

const fullProfiles: Partial<Record<EnvironmentName, Record<StagedWorkload, WorkloadStage[]>>> = {
  local: {
    authenticatedLoad: [
      { duration: '2m', target: 5 },
      { duration: '5m', target: 5 },
      { duration: '1m', target: 0 },
    ],
    authenticatedStress: [
      { duration: '2m', target: 5 },
      { duration: '5m', target: 20 },
      { duration: '2m', target: 0 },
    ],
    stress: [
      { duration: '2m', target: 25 },
      { duration: '3m', target: 50 },
      { duration: '3m', target: 100 },
      { duration: '3m', target: 150 },
      { duration: '2m', target: 0 },
    ],
    spike: [
      { duration: '2m', target: 10 },
      { duration: '30s', target: 200 },
      { duration: '1m', target: 200 },
      { duration: '30s', target: 10 },
      { duration: '3m', target: 10 },
      { duration: '1m', target: 0 },
    ],
    soak: [
      { duration: '5m', target: 20 },
      { duration: '2h', target: 20 },
      { duration: '5m', target: 0 },
    ],
    breakpoint: [
      { duration: '2m', target: 50 },
      { duration: '2m', target: 100 },
      { duration: '2m', target: 200 },
      { duration: '2m', target: 400 },
      { duration: '1m', target: 400 },
      { duration: '1m', target: 0 },
    ],
  },
};

const validationProfiles: Record<StagedWorkload, WorkloadStage[]> = {
  authenticatedLoad: [
    { duration: '5s', target: 1 },
    { duration: '5s', target: 0 },
  ],
  authenticatedStress: [
    { duration: '5s', target: 1 },
    { duration: '5s', target: 0 },
  ],
  stress: [
    { duration: '5s', target: 5 },
    { duration: '5s', target: 0 },
  ],
  spike: [
    { duration: '3s', target: 2 },
    { duration: '3s', target: 20 },
    { duration: '5s', target: 2 },
  ],
  soak: [
    { duration: '5s', target: 2 },
    { duration: '10s', target: 2 },
    { duration: '5s', target: 0 },
  ],
  breakpoint: [
    { duration: '5s', target: 5 },
    { duration: '5s', target: 20 },
    { duration: '5s', target: 0 },
  ],
};

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
 * Resolves a typed stage profile for the selected environment and test profile.
 * A workload can be overridden with a JSON array in its derived environment variable, such as
 * `STRESS_STAGES` or `AUTHENTICATED_LOAD_STAGES`.
 * @param workload Named staged workload.
 * @returns Validated duration/target stages.
 * @throws When an override is invalid JSON or is not a non-empty duration/target array.
 */
export function getWorkloadStages(workload: StagedWorkload): WorkloadStage[] {
  const overrideName =
    `${workload.replace(/[A-Z]/g, (letter) => `_${letter}`)}_STAGES`.toUpperCase();
  const raw = __ENV[overrideName];
  if (raw) {
    let stages: unknown;
    try {
      stages = JSON.parse(raw) as unknown;
    } catch {
      throw new Error(`${overrideName} must contain valid JSON`);
    }
    if (
      !Array.isArray(stages) ||
      stages.length === 0 ||
      stages.some(
        (stage) =>
          typeof stage !== 'object' ||
          stage === null ||
          typeof (stage as WorkloadStage).duration !== 'string' ||
          !Number.isInteger((stage as WorkloadStage).target) ||
          (stage as WorkloadStage).target < 0,
      )
    ) {
      throw new Error(`${overrideName} must be a non-empty JSON array of duration/target stages`);
    }
    return stages as WorkloadStage[];
  }
  const config = getConfig();
  if (__ENV.TEST_PROFILE === 'validation') return validationProfiles[workload];
  const environmentProfile = fullProfiles[config.environment];
  if (!environmentProfile) {
    throw new Error(
      `Full ${workload} profile is not defined for ${config.environment}; provide ${overrideName}`,
    );
  }
  return environmentProfile[workload];
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
