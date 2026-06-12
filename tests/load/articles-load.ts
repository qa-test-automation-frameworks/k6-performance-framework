import type { Options } from 'k6/options';
import { loadThresholds } from '../../config/thresholds/load';
import { getWorkloadProfile } from '../../config/workloads';
import { browseArticles } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

const profile = getWorkloadProfile();
export const options: Options = {
  scenarios: {
    article_readers: profile.validation
      ? {
          executor: 'per-vu-iterations',
          vus: 2,
          iterations: 2,
          maxDuration: '15s',
          gracefulStop: '5s',
        }
      : {
          executor: 'constant-arrival-rate',
          rate: profile.targetRps,
          timeUnit: '1s',
          duration: '8m',
          preAllocatedVUs: Math.min(20, profile.maxVus),
          maxVUs: profile.maxVus,
          gracefulStop: '30s',
        },
  },
  thresholds: loadThresholds,
  summaryTrendStats,
};
export default browseArticles;
export const handleSummary = createSummary;
