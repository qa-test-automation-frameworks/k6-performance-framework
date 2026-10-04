import type { RequestRateProfile } from '../../config/workloads';

export interface AchievedLoad {
  valid: boolean;
  reasons: string[];
  configuredRequestsPerSecond: number;
  measurementSeconds: number;
  minimumAchievedFraction: number;
  completedIterations: number | null;
  startedRequests: number | null;
  requests: number | null;
  droppedIterations: number | null;
  achievedIterationsPerSecond: number | null;
  achievedRequestsPerSecond: number | null;
}

/** Validate the fixed measurement cohort; missing evidence is not zero. */
export function assessAchievedLoad(
  profile: RequestRateProfile,
  counts: {
    iterations?: number | undefined;
    started?: number | undefined;
    requests?: number | undefined;
    dropped?: number | undefined;
  },
): AchievedLoad {
  const reasons: string[] = [];
  const validCount = (value: number | undefined): value is number =>
    value !== undefined && Number.isSafeInteger(value) && value >= 0;
  const iterations = validCount(counts.iterations) ? counts.iterations : null;
  const started = validCount(counts.started) ? counts.started : null;
  const requests = validCount(counts.requests) ? counts.requests : null;
  const dropped = validCount(counts.dropped) ? counts.dropped : null;
  if (iterations === null || requests === null || dropped === null || started === null) {
    reasons.push('Missing or invalid measurement count');
  }
  const expected = profile.requestsPerSecond * profile.measurementSeconds;
  if (iterations !== null && iterations < expected * profile.minimumAchievedFraction) {
    reasons.push('Achieved arrival iterations below predeclared minimum');
  }
  if (requests !== null && requests < expected * profile.minimumAchievedFraction) {
    reasons.push('Achieved HTTP requests below predeclared minimum');
  }
  if (requests !== null && iterations !== null && requests !== iterations) {
    reasons.push('One-request-per-completed-iteration contract violated');
  }
  if (started !== null && requests !== null && started !== requests) {
    reasons.push('Started HTTP attempts did not all complete within the bounded drain');
  }
  if (requests !== null && requests > expected + 1) {
    reasons.push('Request count exceeds configured arrival cohort');
  }
  if (dropped !== null && dropped > 0) reasons.push('Generator dropped measurement iterations');
  return {
    valid: reasons.length === 0,
    reasons,
    configuredRequestsPerSecond: profile.requestsPerSecond,
    measurementSeconds: profile.measurementSeconds,
    minimumAchievedFraction: profile.minimumAchievedFraction,
    completedIterations: iterations,
    startedRequests: started,
    requests,
    droppedIterations: dropped,
    achievedIterationsPerSecond:
      iterations === null ? null : iterations / profile.measurementSeconds,
    achievedRequestsPerSecond: requests === null ? null : requests / profile.measurementSeconds,
  };
}
