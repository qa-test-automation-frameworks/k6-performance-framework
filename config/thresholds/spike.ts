import type { ThresholdSet } from '../../src/types/config.types';

export const spikeThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_failed: [{ threshold: 'rate<0.10', abortOnFail: true, delayAbortEval: '20s' }],
  http_req_duration: [
    { threshold: 'p(95)<3000', abortOnFail: true, delayAbortEval: '30s' },
    'p(99)<5000',
  ],
  dropped_iterations: ['count<50'],
};
