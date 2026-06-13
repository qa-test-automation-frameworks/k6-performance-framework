import { afterEach, describe, expect, it, vi } from 'vitest';
import { setTestEnv } from './setup';

const register = vi.fn();

vi.mock('../../src/api', () => ({
  createApi: () => ({ auth: { register } }),
}));

describe('createAuthenticatedSetup', () => {
  afterEach(() => {
    register.mockReset();
    setTestEnv({});
  });

  it('returns the registered user token and username', async () => {
    register.mockReturnValue({
      status: 201,
      data: { user: { token: 'token', username: 'user' } },
      raw: {},
    });
    const { createAuthenticatedSetup } = await import('../../src/helpers/lifecycle');

    expect(createAuthenticatedSetup()).toEqual({ token: 'token', username: 'user' });
    expect(register).toHaveBeenCalledOnce();
  });

  it('rejects non-local writes before registering a user', async () => {
    setTestEnv({ TARGET_ENV: 'staging' });
    const { createAuthenticatedSetup } = await import('../../src/helpers/lifecycle');

    expect(() => createAuthenticatedSetup()).toThrow('ALLOW_NON_LOCAL_LOAD=true');
    expect(register).not.toHaveBeenCalled();
  });

  it('propagates a missing registration response body', async () => {
    register.mockReturnValue({ status: 500, data: null, raw: {} });
    const { createAuthenticatedSetup } = await import('../../src/helpers/lifecycle');

    expect(() => createAuthenticatedSetup()).toThrow('returned no JSON body');
  });
});
