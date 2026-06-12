import { group, sleep } from 'k6';
import { getWorkloadProfile } from '../../config/workloads';
import { createApi } from '../api';
import { articleFixture } from '../fixtures';
import { assertWriteTarget, checkStatus, requireData, tokenForVu } from '../helpers';

const thinkTimeSeconds = getWorkloadProfile().thinkTimeSeconds;

export function authenticatedCrud(): void {
  assertWriteTarget();
  const token = tokenForVu();
  const api = createApi();
  group('authenticated article CRUD', () => {
    const created = api.articles.create(token, articleFixture());
    checkStatus(created, 201, 'create article');
    const slug = requireData(created, 'create article').article.slug;
    try {
      checkStatus(
        api.articles.update(token, slug, { description: 'Updated by k6' }),
        200,
        'update article',
      );
      checkStatus(
        api.comments.create(token, slug, { body: 'Performance comment' }),
        200,
        'create comment',
      );
      checkStatus(api.articles.favorite(token, slug), 200, 'favorite article');
      checkStatus(api.articles.unfavorite(token, slug), 200, 'unfavorite article');
    } finally {
      checkStatus(api.articles.delete(token, slug), 204, 'delete article');
    }
  });
  sleep(thinkTimeSeconds);
}
