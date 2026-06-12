import type { Options } from 'k6/options';
import { soakThresholds } from '../../config/thresholds/soak';
import { concurrentReaders } from '../../src/scenarios';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '5s', target: 2 }, { duration: '10s', target: 2 }, { duration: '5s', target: 0 }]
    : [{ duration: '5m', target: 20 }, { duration: '2h', target: 20 }, { duration: '5m', target: 0 }],
  thresholds: soakThresholds,
};
export default concurrentReaders;
