import { createApi } from '../api';
import { userFixture } from '../fixtures';
import { checkStatus, requireData } from './checks';
import { assertWriteTarget } from './safety';

export interface AuthenticatedSetupData {
  users: Array<{ token: string; username: string }>;
}

function setupUserCount(): number {
  const value = Number(__ENV.AUTH_USER_COUNT ?? '5');
  if (!Number.isInteger(value) || value < 1 || value > 100) {
    throw new Error('AUTH_USER_COUNT must be an integer between 1 and 100');
  }
  return value;
}

/** Creates a disposable authenticated user pool for controlled write scenarios. */
export function createAuthenticatedSetup(): AuthenticatedSetupData {
  assertWriteTarget();
  const api = createApi();
  const users = Array.from({ length: setupUserCount() }, () => {
    const response = api.auth.register(userFixture());
    checkStatus(response, 201, 'register setup user');
    const created = requireData(response, 'register setup user').user;
    return { token: created.token, username: created.username };
  });
  return { users };
}

export function setupUserForVu(
  data: AuthenticatedSetupData,
  vu = __VU,
): {
  token: string;
  username: string;
} {
  const user = data.users[(vu - 1) % data.users.length];
  if (!user) throw new Error('Authenticated setup returned no users');
  return user;
}
