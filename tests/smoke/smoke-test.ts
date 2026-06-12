import type { Options } from 'k6/options';
import { smokeThresholds } from '../../config/thresholds/smoke';
import { browseArticles } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

export const options: Options = {
  scenarios: {
    smoke_reader: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: __ENV.TEST_PROFILE === 'validation' ? 1 : 3,
      maxDuration: '1m',
      gracefulStop: '10s',
    },
  },
  thresholds: smokeThresholds,
  summaryTrendStats,
};

export default browseArticles;
export const handleSummary = createSummary;
