import { group, sleep } from 'k6';
import { createApi } from '../api';
import { checkStatus, requireData } from '../helpers';

export function browseArticles(): void {
  const api = createApi();
  group('browse articles', () => {
    const list = api.articles.list({ limit: 10, offset: 0 });
    checkStatus(list, 200, 'list articles');
    const first = requireData(list, 'list articles').articles[0];
    if (first) {
      checkStatus(api.articles.get(first.slug), 200, 'get article');
      checkStatus(api.comments.list(first.slug), 200, 'list comments');
      checkStatus(api.profiles.get(first.author.username), 200, 'get profile');
    }
    checkStatus(api.tags.list(), 200, 'list tags');
  });
  sleep(1);
}
