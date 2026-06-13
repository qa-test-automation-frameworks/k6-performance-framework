import type { ThresholdSet } from '../../src/types/config.types';

export const authenticatedThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_duration: ['p(95)<2000', 'p(99)<3500'],
  http_req_failed: ['rate<0.02'],
  'http_req_duration{name:POST /users}': ['p(95)<800', 'p(99)<1500'],
  'http_req_duration{name:POST /articles}': ['p(95)<1000', 'p(99)<2000'],
  'http_req_duration{name:PUT /articles/:slug}': ['p(95)<1000', 'p(99)<2000'],
  'http_req_duration{name:POST /articles/:slug/comments}': ['p(95)<750', 'p(99)<1500'],
  'http_req_duration{name:POST /articles/:slug/favorite}': ['p(95)<1000', 'p(99)<2000'],
  'http_req_duration{name:DELETE /articles/:slug/favorite}': ['p(95)<1000', 'p(99)<2000'],
  'http_req_duration{name:DELETE /articles/:slug}': ['p(95)<1000', 'p(99)<2000'],
  'http_reqs{name:POST /users}': ['count>0'],
  'http_reqs{name:POST /articles}': ['count>0'],
  'http_reqs{name:PUT /articles/:slug}': ['count>0'],
  'http_reqs{name:POST /articles/:slug/comments}': ['count>0'],
  'http_reqs{name:DELETE /articles/:slug}': ['count>0'],
  custom_auth_duration_ms: ['p(95)<800', 'p(99)<1500'],
  custom_auth_success_rate: ['rate>0.99'],
  custom_article_write_duration_ms: ['p(95)<1000', 'p(99)<2000'],
  custom_business_errors_total: ['count<1'],
};
