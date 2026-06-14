import { check } from 'k6';
import type { Options } from 'k6/options';
import { perVuIterations } from '../../config/workloads';
import { createApi } from '../../src/api';
import { createSummary } from '../../src/helpers';
import { summaryTrendStats } from '../../src/types/config.types';
import { smokeThresholds } from '../../config/thresholds/smoke';

export const options: Options = {
  scenarios: {
    health_check: perVuIterations(1, 1, '30s', '5s'),
  },
  thresholds: {
    checks: smokeThresholds.checks!,
    http_req_failed: smokeThresholds.http_req_failed!,
  },
  summaryTrendStats,
};

export default function (): void {
  const api = createApi();
  const tags = api.tags.list();
  const articles = api.articles.list({ limit: 1 });
  check(null, {
    'tags endpoint is reachable': () => tags.status === 200,
    'articles endpoint is reachable': () => articles.status === 200,
  });
}

export const handleSummary = createSummary;
