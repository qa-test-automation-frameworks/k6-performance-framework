import { describe, expect, it, vi } from 'vitest';
import http from 'k6/http';
import { authenticatedCrud, browseArticles, concurrentReaders } from '../../src/scenarios';

function response<T>(data: T, status = 200) {
  return { data, status, raw: {}, headers: {}, attempts: 1 };
}

describe('scenario transaction coverage', () => {
  it('executes article, comment, profile, and tag reads for inspecting readers', () => {
    const api = {
      articles: {
        list: vi.fn(() =>
          response({
            articles: [{ slug: 'seed', author: { username: 'reader' } }],
            articlesCount: 1,
          }),
        ),
        get: vi.fn(() => response({ article: {} })),
      },
      comments: { list: vi.fn(() => response({ comments: [] })) },
      profiles: { get: vi.fn(() => response({ profile: {} })) },
      tags: { list: vi.fn(() => response({ tags: [] })) },
    };

    browseArticles(api as never, {
      name: 'inspecting-reader',
      weight: 1,
      articleLimit: 10,
      inspectArticle: true,
    });

    expect(api.articles.get).toHaveBeenCalledWith('seed');
    expect(api.comments.list).toHaveBeenCalledWith('seed');
    expect(api.profiles.get).toHaveBeenCalledWith('reader');
    expect(api.tags.list).toHaveBeenCalledOnce();
  });

  it('executes and cleans up the complete authenticated journey', () => {
    const api = {
      articles: {
        create: vi.fn(() => response({ article: { slug: 'created' } }, 201)),
        update: vi.fn(() => response({ article: {} })),
        favorite: vi.fn(() => response({ article: {} })),
        unfavorite: vi.fn(() => response({ article: {} })),
        delete: vi.fn(() => response({}, 204)),
      },
      comments: { create: vi.fn(() => response({ comment: {} }, 201)) },
    };

    authenticatedCrud('token', api as never);

    expect(api.articles.update).toHaveBeenCalled();
    expect(api.comments.create).toHaveBeenCalled();
    expect(api.articles.favorite).toHaveBeenCalled();
    expect(api.articles.unfavorite).toHaveBeenCalled();
    expect(api.articles.delete).toHaveBeenCalledWith('token', 'created');
  });

  it('executes the high-concurrency reader journey', () => {
    vi.mocked(http.request).mockReturnValue({
      status: 200,
      body: '{"articles":[],"tags":[]}',
      headers: {},
      json: () => ({ articles: [], tags: [] }),
      timings: { duration: 10 },
    } as never);
    concurrentReaders();
  });
});
