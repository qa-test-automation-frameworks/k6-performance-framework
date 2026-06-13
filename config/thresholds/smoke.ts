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
  'http_req_failed{name:GET /articles}': ['rate<0.01'],
  'http_req_failed{name:GET /tags}': ['rate<0.01'],
  custom_article_read_success_rate: ['rate>0.99'],
  custom_tag_success_rate: ['rate>0.99'],
  custom_business_errors_total: ['count<1'],
};
