import { afterEach, describe, expect, it } from 'vitest';
import { getConfig } from '../../config';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';
import { breakpointThresholds } from '../../config/thresholds/breakpoint';
import { loadThresholds } from '../../config/thresholds/load';
import { soakThresholds } from '../../config/thresholds/soak';
import { spikeThresholds } from '../../config/thresholds/spike';
import { stressThresholds } from '../../config/thresholds/stress';
import { getWorkloadProfile } from '../../config/workloads';
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
    expect(getConfig().readOnly).toBe(true);
    setTestEnv({ TARGET_ENV: 'staging', ALLOW_NON_LOCAL_LOAD: 'true' });
    expect(getConfig().readOnly).toBe(false);
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
});
