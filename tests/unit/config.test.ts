import { afterEach, describe, expect, it } from 'vitest';
import { getConfig } from '../../config';
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
    expect(getConfig().baseUrl).toBe('https://conduit.realworld.how/api');
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
});
