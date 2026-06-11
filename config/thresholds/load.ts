import type { ThresholdSet } from '../../src/types/config.types';

export const loadThresholds: ThresholdSet = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.02'],
};
