import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTestEnv } from './setup';

describe('tokenForVu', () => {
  afterEach(() => {
    vi.resetModules();
    setTestEnv({});
  });

  it('distributes tokens across virtual users', async () => {
    setTestEnv({ K6_USER_TOKENS: '["first","second"]' });
    const { tokenForVu } = await import('../../src/helpers/auth');
    expect(tokenForVu(1)).toBe('first');
    expect(tokenForVu(2)).toBe('second');
    expect(tokenForVu(3)).toBe('first');
  });

  it('rejects missing and invalid token pools', async () => {
    const missing = await import('../../src/helpers/auth');
    expect(() => missing.tokenForVu(1)).toThrow('K6_USER_TOKENS is required');

    vi.resetModules();
    setTestEnv({ K6_USER_TOKENS: '{"token":"invalid"}' });
    await expect(import('../../src/helpers/auth')).rejects.toThrow('JSON array of strings');
  });
});
