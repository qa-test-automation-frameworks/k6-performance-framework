import type { Options } from 'k6/options';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';
import { getWorkloadStages, rampingVus } from '../../config/workloads';
import { authenticatedCrud } from '../../src/scenarios';
import {
  assertAuthorizedLoadTarget,
  createAuthenticatedSetup,
  createSummary,
  setupUserForVu,
  type AuthenticatedSetupData,
} from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Authenticated stress', write: true });
export const options: Options = {
  scenarios: {
    authenticated_stress: rampingVus(getWorkloadStages('authenticatedStress')),
  },
  thresholds: authenticatedThresholds,
  summaryTrendStats,
};

export function setup(): AuthenticatedSetupData {
  return createAuthenticatedSetup();
}

export default function (data: AuthenticatedSetupData): void {
  authenticatedCrud(setupUserForVu(data).token);
}

export const handleSummary = createSummary;
