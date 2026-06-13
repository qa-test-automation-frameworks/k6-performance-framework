import type { ThresholdSet } from '../../src/types/config.types';

export const stressThresholds: ThresholdSet = {
  http_req_duration: [
    { threshold: 'p(95)<2000', abortOnFail: false },
    { threshold: 'p(99)<3500', abortOnFail: false },
  ],
  http_req_failed: [{ threshold: 'rate<0.05', abortOnFail: false }],
  'http_req_duration{name:GET /articles}': ['p(95)<1500', 'p(99)<3000'],
  'http_req_duration{name:GET /articles/:slug}': ['p(95)<1500', 'p(99)<3000'],
  'http_req_duration{name:GET /tags}': ['p(95)<750', 'p(99)<1500'],
  custom_business_errors_total: ['count<50'],
  iterations: ['rate>5'],
};
