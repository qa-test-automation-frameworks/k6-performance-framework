import { group, sleep } from 'k6';
import { getWorkloadProfile } from '../../config/workloads';
import { createApi } from '../api';
import { checkStatus } from '../helpers';

/** Executes a lightweight list-and-tags journey for high-concurrency read workloads. */
export function concurrentReaders(): void {
  const api = createApi();
  group('concurrent readers', () => {
    checkStatus(api.articles.list({ limit: 10, offset: 0 }), 200, 'list articles');
    checkStatus(api.tags.list(), 200, 'list tags');
  });
  sleep(Math.max(0.1, getWorkloadProfile().thinkTimeSeconds / 2));
}

/** Exercises deeper reads to expose cache and downstream dependency pressure. */
export function stressReaders(): void {
  const api = createApi();
  group('stress readers', () => {
    const list = api.articles.list({ limit: 20, offset: (__ITER % 5) * 20 });
    checkStatus(list, 200, 'stress list articles');
    const articles = list.data?.articles.slice(0, 3) ?? [];
    for (const article of articles) {
      checkStatus(api.articles.get(article.slug), 200, 'stress get article');
      checkStatus(api.comments.list(article.slug), 200, 'stress list comments');
    }
  });
  sleep(Math.max(0.1, getWorkloadProfile().thinkTimeSeconds / 3));
}

/** Uses a short read path so a spike measures saturation and recovery rather than think time. */
export function spikeReaders(): void {
  const api = createApi();
  group('spike readers', () => {
    checkStatus(api.articles.list({ limit: 5, offset: 0 }), 200, 'spike list articles');
  });
  sleep(0.1);
}

/** Alternates query offsets during long runs to detect stability and retention drift. */
export function soakReaders(): void {
  const api = createApi();
  group('soak readers', () => {
    const offset = (__ITER % 10) * 5;
    checkStatus(api.articles.list({ limit: 5, offset }), 200, 'soak list articles');
    checkStatus(api.tags.list(), 200, 'soak list tags');
  });
  sleep(getWorkloadProfile().thinkTimeSeconds);
}

/** Minimizes client-side work while searching for the target's concurrency boundary. */
export function capacityReaders(): void {
  const api = createApi();
  checkStatus(api.articles.list({ limit: 1, offset: __ITER % 10 }), 200, 'capacity list articles');
}
