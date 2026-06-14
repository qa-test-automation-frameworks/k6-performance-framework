import { afterEach, describe, expect, it, vi } from 'vitest';
import { getConfig } from '../../config';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';
import { breakpointThresholds } from '../../config/thresholds/breakpoint';
import { loadThresholds, observabilityProbeThresholds } from '../../config/thresholds/load';
import { soakThresholds } from '../../config/thresholds/soak';
import { spikeThresholds } from '../../config/thresholds/spike';
import { stressThresholds } from '../../config/thresholds/stress';
import {
  constantArrivalRate,
  getWorkloadProfile,
  perVuIterations,
  rampingVus,
} from '../../config/workloads';
import { assertAuthorizedLoadTarget } from '../../src/helpers/safety';
import { setTestEnv } from './setup';

describe('getConfig', () => {
  afterEach(() => {
    setTestEnv({});
  });

  it('defaults to local configuration', () => {
    expect(getConfig().environment).toBe('local');
  });

  it('selects staging through TARGET_ENV', () => {
    setTestEnv({ TARGET_ENV: 'staging' });
    expect(getConfig().baseUrl).toBe('https://api.realworld.show/api');
  });

  it('applies BASE_URL overrides', () => {
    setTestEnv({ BASE_URL: 'https://example.test/api' });
    expect(getConfig().baseUrl).toBe('https://example.test/api');
  });

  it('requires a production BASE_URL', () => {
    setTestEnv({ TARGET_ENV: 'production' });
    expect(() => getConfig()).toThrow('BASE_URL is required');
  });

  it('rejects unknown environments', () => {
    expect(() => getConfig('qa')).toThrow('Unknown TARGET_ENV');
  });

  it('validates and applies workload overrides', () => {
    setTestEnv({ TARGET_RPS: '12', MAX_VUS: '40', THINK_TIME_SECONDS: '0.5' });
    expect(getWorkloadProfile()).toMatchObject({
      targetRps: 12,
      maxVus: 40,
      thinkTimeSeconds: 0.5,
    });
    setTestEnv({ TARGET_RPS: '0' });
    expect(() => getWorkloadProfile()).toThrow('TARGET_RPS must be a positive number');
  });

  it('authorizes controlled non-local writes only with an explicit override', () => {
    setTestEnv({ TARGET_ENV: 'staging' });
    expect(getConfig().allowsWrites).toBe(false);
    setTestEnv({ TARGET_ENV: 'staging', ALLOW_NON_LOCAL_LOAD: 'true' });
    expect(getConfig().allowsWrites).toBe(true);
  });

  it('blocks every non-local sustained workload without explicit authorization', () => {
    setTestEnv({ TARGET_ENV: 'staging' });
    expect(() => assertAuthorizedLoadTarget({ workload: 'Stress' })).toThrow(
      'ALLOW_NON_LOCAL_LOAD=true',
    );

    setTestEnv({ TARGET_ENV: 'staging', ALLOW_NON_LOCAL_LOAD: 'true' });
    expect(() => assertAuthorizedLoadTarget({ workload: 'Stress' })).not.toThrow();
  });
});

describe('load thresholds', () => {
  it('requires samples for every mandatory read transaction', () => {
    expect(loadThresholds).toMatchObject({
      'http_reqs{name:GET /articles}': ['count>0'],
      'http_reqs{name:GET /articles/:slug}': ['count>0'],
      'http_reqs{name:GET /tags}': ['count>0'],
    });
  });

  it('keeps observability probes focused on telemetry health', () => {
    expect(observabilityProbeThresholds).toEqual({
      checks: ['rate==1'],
      http_req_failed: ['rate<0.02'],
      http_reqs: ['count>0'],
    });
  });

  it('fails every workload when functional checks fail', () => {
    for (const thresholds of [
      authenticatedThresholds,
      loadThresholds,
      stressThresholds,
      spikeThresholds,
      soakThresholds,
      breakpointThresholds,
    ]) {
      expect(thresholds.checks).toEqual(['rate==1']);
    }
  });

  it('keeps stress and soak thresholds exploratory by default', () => {
    expect(stressThresholds.http_req_duration).toContainEqual({
      threshold: 'p(95)<2000',
      abortOnFail: false,
    });
    expect(soakThresholds.http_req_failed).toContainEqual({
      threshold: 'rate<0.01',
      abortOnFail: false,
    });
  });

  it('can promote stress and soak thresholds to release gates', async () => {
    setTestEnv({ PERF_STRICT_THRESHOLDS: 'true' });
    vi.resetModules();
    const [{ stressThresholds: strictStress }, { soakThresholds: strictSoak }] = await Promise.all([
      import('../../config/thresholds/stress'),
      import('../../config/thresholds/soak'),
    ]);

    expect(strictStress.http_req_duration).toContainEqual({
      threshold: 'p(95)<2000',
      abortOnFail: true,
    });
    expect(strictSoak.http_req_failed).toContainEqual({
      threshold: 'rate<0.01',
      abortOnFail: true,
    });
  });
});

describe('workload builders', () => {
  it('builds all supported executor shapes', () => {
    expect(rampingVus([{ duration: '1m', target: 2 }])).toMatchObject({
      executor: 'ramping-vus',
      gracefulRampDown: '30s',
    });
    expect(perVuIterations(2, 3, '1m')).toMatchObject({
      executor: 'per-vu-iterations',
      vus: 2,
      iterations: 3,
    });
    expect(
      constantArrivalRate(
        { validation: false, targetRps: 12, maxVus: 40, thinkTimeSeconds: 1 },
        '5m',
      ),
    ).toMatchObject({
      executor: 'constant-arrival-rate',
      rate: 12,
      preAllocatedVUs: 20,
      maxVUs: 40,
    });
  });
});
