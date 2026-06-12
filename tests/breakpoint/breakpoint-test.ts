import type { Options } from 'k6/options';
import { concurrentReaders } from '../../src/scenarios';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';

const validation = __ENV.TEST_PROFILE === 'validation';
export const options: Options = {
  scenarios: {
    capacity_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: validation
        ? [
            { duration: '5s', target: 5 },
            { duration: '5s', target: 20 },
          ]
        : [
            { duration: '2m', target: 50 },
            { duration: '2m', target: 100 },
            { duration: '2m', target: 200 },
            { duration: '2m', target: 400 },
          ],
      gracefulRampDown: '30s',
      gracefulStop: '30s',
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '10s' }],
    http_req_duration: [
      { threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '10s' },
      { threshold: 'p(99)<5000', abortOnFail: true, delayAbortEval: '10s' },
    ],
  },
  summaryTrendStats,
};
export default concurrentReaders;
export const handleSummary = createSummary;
