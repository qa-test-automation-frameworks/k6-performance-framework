import type { Options } from 'k6/options';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';
import { getWorkloadProfile, rampingVus } from '../../config/workloads';
import { authenticatedCrud } from '../../src/scenarios';
import {
  assertAuthorizedLoadTarget,
  createAuthenticatedSetup,
  createSummary,
  type AuthenticatedSetupData,
} from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Authenticated load', write: true });
const profile = getWorkloadProfile();
export const options: Options = {
  scenarios: {
    authenticated_users: rampingVus(
      profile.validation
        ? [
            { duration: '5s', target: 1 },
            { duration: '5s', target: 0 },
          ]
        : [
            { duration: '2m', target: 5 },
            { duration: '5m', target: 5 },
            { duration: '1m', target: 0 },
          ],
    ),
  },
  thresholds: authenticatedThresholds,
  summaryTrendStats,
};

export function setup(): AuthenticatedSetupData {
  return createAuthenticatedSetup();
}

export default function (data: AuthenticatedSetupData): void {
  authenticatedCrud(data.token);
}

export const handleSummary = createSummary;
