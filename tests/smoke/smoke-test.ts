import type { Options } from 'k6/options';
import { smokeThresholds } from '../../config/thresholds/smoke';
import { browseArticles } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

export const options: Options = {
  vus: 1,
  duration: __ENV.TEST_PROFILE === 'validation' ? '5s' : '30s',
  thresholds: smokeThresholds,
  summaryTrendStats,
};

export default browseArticles;
export const handleSummary = createSummary;
