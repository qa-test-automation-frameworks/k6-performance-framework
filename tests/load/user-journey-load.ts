import type { Options } from 'k6/options';
import { loadThresholds } from '../../config/thresholds/load';
import { authenticatedCrud } from '../../src/scenarios';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '5s', target: 1 }, { duration: '5s', target: 0 }]
    : [{ duration: '2m', target: 5 }, { duration: '5m', target: 5 }, { duration: '1m', target: 0 }],
  thresholds: loadThresholds,
};
export default authenticatedCrud;
