import { check } from 'k6';
import type { Options } from 'k6/options';
import { createApi } from '../../src/api';
import { createSummary } from '../../src/helpers';

export const options: Options = { vus: 1, iterations: 1 };

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
