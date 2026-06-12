import type { ThresholdSet } from '../../src/types/config.types';

export const smokeThresholds: ThresholdSet = {
  http_req_duration: [
    { threshold: 'p(95)<500', abortOnFail: true, delayAbortEval: '10s' },
    { threshold: 'p(99)<1000', abortOnFail: true, delayAbortEval: '10s' },
  ],
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: true, delayAbortEval: '10s' }],
  checks: [{ threshold: 'rate>0.99', abortOnFail: true, delayAbortEval: '10s' }],
  'http_req_duration{name:GET /articles}': ['p(95)<500', 'p(99)<1000'],
  'http_req_duration{name:GET /tags}': ['p(95)<300', 'p(99)<750'],
};
