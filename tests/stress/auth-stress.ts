import type { Options } from 'k6/options';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';
import { rampingVus } from '../../config/workloads';
import { authenticatedCrud } from '../../src/scenarios';
import {
  assertAuthorizedLoadTarget,
  createAuthenticatedSetup,
  createSummary,
  type AuthenticatedSetupData,
} from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Authenticated stress', write: true });
const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    authenticated_stress: rampingVus(
      validation
        ? [
            { duration: '5s', target: 1 },
            { duration: '5s', target: 0 },
          ]
        : [
            { duration: '2m', target: 5 },
            { duration: '5m', target: 20 },
            { duration: '2m', target: 0 },
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
