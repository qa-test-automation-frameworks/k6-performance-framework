import type { Options } from 'k6/options';
import { concurrentReaders } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    traffic_spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: validation
        ? [
            { duration: '3s', target: 2 },
            { duration: '3s', target: 20 },
            { duration: '5s', target: 2 },
          ]
        : [
            { duration: '2m', target: 10 },
            { duration: '30s', target: 200 },
            { duration: '1m', target: 200 },
            { duration: '30s', target: 10 },
            { duration: '3m', target: 10 },
            { duration: '1m', target: 0 },
          ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.10'],
    http_req_duration: ['p(95)<3000', 'p(99)<5000'],
  },
  tags: { test_type: 'spike' },
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
