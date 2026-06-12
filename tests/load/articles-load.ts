import type { Options } from 'k6/options';
import { loadThresholds } from '../../config/thresholds/load';
import { browseArticles } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '5s', target: 2 }, { duration: '5s', target: 0 }]
    : [{ duration: '2m', target: 20 }, { duration: '5m', target: 20 }, { duration: '1m', target: 0 }],
  thresholds: loadThresholds,
};
export default browseArticles;
export const handleSummary = createSummary;
