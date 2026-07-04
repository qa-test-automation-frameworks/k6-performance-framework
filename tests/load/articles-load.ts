import type { Options } from 'k6/options';
import {
  loadThresholds,
  observabilityProbeThresholds,
  realisticScaleLoadThresholds,
} from '../../config/thresholds/load';
import { constantArrivalRate, getWorkloadProfile, perVuIterations } from '../../config/workloads';
import { browseArticles } from '../../src/scenarios';
import { assertAuthorizedLoadTarget, createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

assertAuthorizedLoadTarget({ workload: 'Load' });
const profile = getWorkloadProfile();
export const options: Options = {
  scenarios: {
    article_readers: profile.validation
      ? perVuIterations(2, 2, '15s', '5s')
      : constantArrivalRate(profile, '8m'),
  },
  thresholds:
    __ENV.OBSERVABILITY_PROBE === 'true'
      ? observabilityProbeThresholds
      : __ENV.TARGET_RPS === '500'
        ? realisticScaleLoadThresholds
        : loadThresholds,
  summaryTrendStats,
};
export default browseArticles;
export const handleSummary = createSummary;
