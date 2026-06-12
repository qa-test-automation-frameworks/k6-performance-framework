import type { Options } from 'k6/options';
import { concurrentReaders } from '../../src/scenarios';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  stages: validation
    ? [{ duration: '3s', target: 2 }, { duration: '3s', target: 20 }, { duration: '5s', target: 2 }]
    : [
        { duration: '2m', target: 10 }, { duration: '30s', target: 200 },
        { duration: '1m', target: 200 }, { duration: '30s', target: 10 },
        { duration: '3m', target: 10 }, { duration: '1m', target: 0 },
      ],
  thresholds: { http_req_failed: ['rate<0.10'], http_req_duration: ['p(95)<3000'] },
  tags: { test_type: 'spike' },
};
export default concurrentReaders;
