import type { Options } from 'k6/options';
import { stressThresholds } from '../../config/thresholds/stress';
import { concurrentReaders } from '../../src/scenarios';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '5s', target: 5 }, { duration: '5s', target: 0 }]
    : [
        { duration: '2m', target: 25 }, { duration: '3m', target: 50 },
        { duration: '3m', target: 100 }, { duration: '3m', target: 150 },
        { duration: '2m', target: 0 },
      ],
  thresholds: stressThresholds,
};
export default concurrentReaders;
