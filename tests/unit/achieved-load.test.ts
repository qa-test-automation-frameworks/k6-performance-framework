import { afterEach, describe, expect, it } from 'vitest';
import { getRequestRateProfile, getWorkloadProfile } from '../../config/workloads';
import { assessAchievedLoad } from '../../src/helpers/achieved-load';
import { createSummary } from '../../src/helpers/summary';
import { setTestEnv } from './setup';

const profile = {
  requestsPerSecond: 500,
  measurementSeconds: 60,
  warmupSeconds: 10,
  maxVus: 100,
  minimumAchievedFraction: 0.98,
};

describe('workload unit migration and achieved load', () => {
  afterEach(() => setTestEnv({}));

  it('rejects ambiguous legacy controls even when a new control is also present', () => {
    setTestEnv({ TARGET_RPS: '500', TARGET_ITERATIONS_PER_SECOND: '20' });
    expect(() => getWorkloadProfile()).toThrow('old arrival-iteration semantics');
    expect(() => getRequestRateProfile()).toThrow('dedicated request-rate entry point');
  });

  it.each(['0.5', 'Infinity', '9007199254740992'])('rejects unsafe arrival value %s', (value) => {
    setTestEnv({ TARGET_ITERATIONS_PER_SECOND: value });
    expect(() => getWorkloadProfile()).toThrow();
    setTestEnv({ REQUESTS_PER_SECOND: value });
    expect(() => getRequestRateProfile()).toThrow();
  });

  it('rejects invalid measurement windows, tolerance and count overflow', () => {
    for (const env of [
      { MEASUREMENT_SECONDS: '0' },
      { MINIMUM_ACHIEVED_FRACTION: '1.01' },
      { REQUESTS_PER_SECOND: '9007199254740991', MEASUREMENT_SECONDS: '2' },
    ]) {
      setTestEnv(env);
      expect(() => getRequestRateProfile()).toThrow();
    }
  });

  it('calculates both achieved units using the predeclared measurement window', () => {
    expect(
      assessAchievedLoad(profile, { iterations: 30000, requests: 30000, dropped: 0 }),
    ).toMatchObject({
      valid: true,
      achievedRequestsPerSecond: 500,
      achievedIterationsPerSecond: 500,
    });
  });

  it.each([
    [{ iterations: 10000, requests: 30000, dropped: 0 }, 'contract violated'],
    [{ iterations: 29000, requests: 29000, dropped: 0 }, 'below predeclared minimum'],
    [{ iterations: 30000, requests: 30000, dropped: 1 }, 'Generator dropped'],
    [{ iterations: 30000, requests: 60000, dropped: 0 }, 'Request count exceeds'],
    [{ iterations: 30000, requests: Number.NaN, dropped: 0 }, 'Missing or invalid'],
    [{ iterations: 30000, requests: 30000 }, 'Missing or invalid'],
  ])('rejects invalid measurement %j', (counts, reason) => {
    const result = assessAchievedLoad(profile, counts);
    expect(result.valid).toBe(false);
    expect(result.reasons.join('; ')).toContain(reason);
  });

  it('does not classify an empty measurement as a passed report', () => {
    setTestEnv({ WORKLOAD_MODE: 'request-rate' });
    const output = createSummary({ metrics: {}, root_group: {}, state: {} });
    const summary = JSON.parse(output['reports/k6-summary-summary.json'] ?? '{}');
    expect(summary.achievedLoad.valid).toBe(false);
    expect(summary.achievedLoad.requests).toBeNull();
    expect(output['reports/k6-summary-summary.md']).toContain('**Run status:** FAILED');
  });

  it('excludes warm-up and native whole-run rates from measurement calculations', () => {
    setTestEnv({ WORKLOAD_MODE: 'request-rate' });
    const output = createSummary({
      metrics: {
        http_reqs: { values: { count: 35000, rate: 420 } },
        'http_reqs{scenario:request_measurement}': { values: { count: 30000, rate: 420 } },
        'iterations{scenario:request_measurement}': { values: { count: 30000 } },
        'dropped_iterations{scenario:request_measurement}': { values: { count: 0 } },
      },
      root_group: {},
      state: { testRunDurationMs: 72000 },
    });
    const summary = JSON.parse(output['reports/k6-summary-summary.json'] ?? '{}');
    expect(summary.achievedLoad.achievedRequestsPerSecond).toBe(500);
    expect(summary.metadata.targetRequestsPerSecond).toBe(500);
    expect(summary.metadata.targetIterationsPerSecond).toBe(500);
    expect(summary.metadata).not.toHaveProperty('targetRps');
  });
});
