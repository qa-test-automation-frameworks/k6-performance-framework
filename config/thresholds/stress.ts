import type { ThresholdSet } from '../../src/types/config.types';
import { releaseGateThreshold } from './policy';

export const stressThresholds: ThresholdSet = {
  checks: ['rate==1'],
  http_req_duration: [releaseGateThreshold('p(95)<2000'), releaseGateThreshold('p(99)<3500')],
  http_req_failed: [releaseGateThreshold('rate<0.05')],
  'http_req_duration{name:GET /articles}': ['p(95)<1500', 'p(99)<3000'],
  'http_req_duration{name:GET /articles/:slug}': ['p(95)<1500', 'p(99)<3000'],
  'http_req_duration{name:GET /tags}': ['p(95)<750', 'p(99)<1500'],
  custom_article_read_success_rate: ['rate>0.95'],
  custom_tag_success_rate: ['rate>0.95'],
  custom_business_errors_total: ['count<50'],
  iterations: ['rate>5'],
};
