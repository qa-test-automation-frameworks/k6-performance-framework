import { describe, expect, it, vi } from 'vitest';
import {
  ArticlesService,
  AuthService,
  CommentsService,
  ProfilesService,
  TagsService,
} from '../../src/api';
import { authenticatedThresholds } from '../../config/thresholds/authenticated';

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

  it('covers the remaining authenticated and mutation operations', () => {
    const mock = client();
    const auth = new AuthService(mock as never);
    const articles = new ArticlesService(mock as never);
    const comments = new CommentsService(mock as never);
    const profiles = new ProfilesService(mock as never);

    auth.register({ username: 'user', email: 'a@example.test', password: 'secret' });
    auth.current('token');
    auth.update('token', { bio: 'updated' });
    articles.feed('token', { limit: 5 });
    articles.get('article slug');
    articles.update('token', 'article slug', { title: 'updated' });
    articles.delete('token', 'article slug');
    articles.favorite('token', 'article slug');
    articles.unfavorite('token', 'article slug');
    comments.create('token', 'article slug', { body: 'comment' });
    comments.delete('token', 'article slug', 7);
    profiles.get('user name', 'token');
    profiles.unfollow('token', 'user name');

    expect(mock.get).toHaveBeenCalledWith('/articles/feed?limit=5', 'GET /articles/feed', {
      params: { headers: { Authorization: 'Token token' } },
    });
    expect(mock.delete).toHaveBeenCalledWith(
      '/articles/article%20slug/comments/7',
      'DELETE /articles/:slug/comments/:id',
      { params: { headers: { Authorization: 'Token token' } } },
    );
  });
});

describe('authenticated thresholds', () => {
  it('enforces every published write and authentication objective', () => {
    expect(authenticatedThresholds).toMatchObject({
      custom_auth_duration_ms: ['p(95)<800', 'p(99)<1500'],
      custom_auth_success_rate: ['rate>0.99'],
      custom_article_write_duration_ms: ['p(95)<1000', 'p(99)<2000'],
      'http_req_duration{name:POST /articles/:slug/comments}': ['p(95)<750', 'p(99)<1500'],
    });
  });
});
