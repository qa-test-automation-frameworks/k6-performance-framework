import type { ThresholdSet } from '../../src/types/config.types';

export const breakpointThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '10s' }],
  http_req_duration: [
    { threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '10s' },
    { threshold: 'p(99)<5000', abortOnFail: true, delayAbortEval: '10s' },
  ],
  iterations: ['rate>5'],
};
