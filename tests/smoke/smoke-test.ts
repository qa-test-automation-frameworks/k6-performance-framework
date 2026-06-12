import type { Options } from 'k6/options';
import { smokeThresholds } from '../../config/thresholds/smoke';
import { perVuIterations } from '../../config/workloads';
import { browseArticles } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

export const options: Options = {
  scenarios: {
    smoke_reader: perVuIterations(1, __ENV.TEST_PROFILE === 'validation' ? 1 : 3, '1m'),
  },
  thresholds: smokeThresholds,
  summaryTrendStats,
};

export default browseArticles;
export const handleSummary = createSummary;
