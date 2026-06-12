import type { ThresholdSet } from '../../src/types/config.types';

export const soakThresholds: ThresholdSet = {
  http_req_duration: [
    { threshold: 'p(95)<1200', abortOnFail: false },
    { threshold: 'p(99)<2500', abortOnFail: false },
  ],
  http_req_failed: [{ threshold: 'rate<0.01', abortOnFail: false }],
  custom_business_errors_total: ['count<10'],
  iterations: ['rate>5'],
};
