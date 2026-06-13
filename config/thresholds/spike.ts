import type { ThresholdSet } from '../../src/types/config.types';

export const spikeThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_failed: ['rate<0.10'],
  http_req_duration: ['p(95)<3000', 'p(99)<5000'],
  dropped_iterations: ['count<50'],
};
