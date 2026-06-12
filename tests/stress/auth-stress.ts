import type { Options } from 'k6/options';
import { stressThresholds } from '../../config/thresholds/stress';
import { authenticatedCrud } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '5s', target: 1 }, { duration: '5s', target: 0 }]
    : [{ duration: '2m', target: 5 }, { duration: '5m', target: 20 }, { duration: '2m', target: 0 }],
  thresholds: stressThresholds,
};
export default authenticatedCrud;
export const handleSummary = createSummary;
