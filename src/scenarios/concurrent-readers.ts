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
