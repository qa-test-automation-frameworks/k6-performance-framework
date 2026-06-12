import { describe, expect, it, vi } from 'vitest';
import {
  ArticlesService,
  AuthService,
  CommentsService,
  ProfilesService,
  TagsService,
} from '../../src/api';

function client() {
  return {
    get: vi.fn(() => ({ status: 200 })),
    post: vi.fn(() => ({ status: 200 })),
    put: vi.fn(() => ({ status: 200 })),
    delete: vi.fn(() => ({ status: 204 })),
  };
}

describe('API services', () => {
  it('uses typed envelopes, encoded queries, auth headers, and stable names', () => {
    const mock = client();
    const articles = new ArticlesService(mock as never);
    articles.list({ tag: 'load test', limit: 10 });
    articles.create('token', { title: 't', description: 'd', body: 'b' });

    expect(mock.get).toHaveBeenCalledWith('/articles?tag=load%20test&limit=10', 'GET /articles');
    expect(mock.post).toHaveBeenCalledWith(
      '/articles',
      'POST /articles',
      { article: { title: 't', description: 'd', body: 'b' } },
      { params: { headers: { Authorization: 'Token token' } } },
    );
  });

  it('maps every service to the RealWorld endpoint contract', () => {
    const mock = client();
    new AuthService(mock as never).login({ email: 'a@example.test', password: 'secret' });
    new CommentsService(mock as never).list('article slug');
    new ProfilesService(mock as never).follow('token', 'user name');
    new TagsService(mock as never).list();

    expect(mock.post).toHaveBeenCalledWith('/users/login', 'POST /users/login', {
      user: { email: 'a@example.test', password: 'secret' },
    });
    expect(mock.get).toHaveBeenCalledWith(
      '/articles/article%20slug/comments',
      'GET /articles/:slug/comments',
    );
    expect(mock.post).toHaveBeenCalledWith(
      '/profiles/user%20name/follow',
      'POST /profiles/:username/follow',
      {},
      { params: { headers: { Authorization: 'Token token' } } },
    );
    expect(mock.get).toHaveBeenCalledWith('/tags', 'GET /tags');
  });
});
