import type { ThresholdSet } from '../../src/types/config.types';

export const loadThresholds: ThresholdSet = {
  http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  http_req_failed: ['rate<0.02'],
  'http_req_duration{name:GET /articles}': ['p(95)<500', 'p(99)<1000'],
  'http_req_duration{name:GET /articles/:slug}': ['p(95)<500', 'p(99)<1000'],
  'http_req_duration{name:GET /tags}': ['p(95)<300', 'p(99)<750'],
  custom_article_read_duration_ms: ['p(95)<500', 'p(99)<1000'],
  custom_business_errors_total: ['count<1'],
  iterations: ['rate>1'],
  dropped_iterations: ['count<10'],
  http_reqs: ['rate>5'],
};
