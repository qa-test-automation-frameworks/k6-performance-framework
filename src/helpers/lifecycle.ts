import { createApi } from '../api';
import { userFixture } from '../fixtures';
import { checkStatus, requireData } from './checks';
import { assertWriteTarget } from './safety';

export interface AuthenticatedSetupData {
  token: string;
  username: string;
}

/** Creates a disposable authenticated user for controlled write scenarios. */
export function createAuthenticatedSetup(): AuthenticatedSetupData {
  assertWriteTarget();
  const user = userFixture();
  const response = createApi().auth.register(user);
  checkStatus(response, 201, 'register setup user');
  const created = requireData(response, 'register setup user').user;
  return { token: created.token, username: created.username };
}
