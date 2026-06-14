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

    expect(createAuthenticatedSetup()).toEqual({
      users: Array.from({ length: 5 }, () => ({ token: 'token', username: 'user' })),
    });
    expect(register).toHaveBeenCalledTimes(5);
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

  it('validates pool size and assigns users by virtual user', async () => {
    setTestEnv({ AUTH_USER_COUNT: '2' });
    register
      .mockReturnValueOnce({
        status: 201,
        data: { user: { token: 'first', username: 'first' } },
        raw: {},
      })
      .mockReturnValueOnce({
        status: 201,
        data: { user: { token: 'second', username: 'second' } },
        raw: {},
      });
    const { createAuthenticatedSetup, setupUserForVu } =
      await import('../../src/helpers/lifecycle');
    const data = createAuthenticatedSetup();

    expect(setupUserForVu(data, 1).token).toBe('first');
    expect(setupUserForVu(data, 2).token).toBe('second');
    expect(setupUserForVu(data, 3).token).toBe('first');

    setTestEnv({ AUTH_USER_COUNT: '0' });
    expect(() => createAuthenticatedSetup()).toThrow('between 1 and 100');
    expect(() => setupUserForVu({ users: [] }, 1)).toThrow('returned no users');
  });
});
