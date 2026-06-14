import type { ThresholdSet } from '../../src/types/config.types';
import { releaseGateThreshold } from './policy';

export const soakThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_duration: [releaseGateThreshold('p(95)<1200'), releaseGateThreshold('p(99)<2500')],
  http_req_failed: [releaseGateThreshold('rate<0.01')],
  'http_req_duration{name:GET /articles}': ['p(95)<750', 'p(99)<1500'],
  'http_req_duration{name:GET /articles/:slug}': ['p(95)<750', 'p(99)<1500'],
  'http_req_duration{name:GET /tags}': ['p(95)<500', 'p(99)<1000'],
  custom_article_read_success_rate: ['rate>0.99'],
  custom_tag_success_rate: ['rate>0.99'],
  custom_business_errors_total: ['count<10'],
  iterations: ['rate>5'],
};
