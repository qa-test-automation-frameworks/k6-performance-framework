import type { ThresholdSet } from '../../src/types/config.types';

export const stressThresholds: ThresholdSet = {
  http_req_duration: [
    { threshold: 'p(95)<2000', abortOnFail: false },
    { threshold: 'p(99)<3500', abortOnFail: false },
  ],
  http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  custom_business_errors_total: ['count<50'],
};
