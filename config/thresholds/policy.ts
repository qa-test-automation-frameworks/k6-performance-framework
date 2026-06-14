import type { Threshold } from 'k6/options';

export function releaseGateThreshold(threshold: string): Threshold {
  return {
    threshold,
    abortOnFail: __ENV.PERF_STRICT_THRESHOLDS === 'true',
  };
}
