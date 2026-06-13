import type {
  ArticlePayload,
  ArticleResponse,
  ArticlesListResponse,
  ArticlesQuery,
  ArticleUpdatePayload,
  EmptyResponse,
  HttpResponse,
} from '../types';
import { HttpClient } from '../utils/http-client';
import { auth } from './auth';
import { toQuery } from './query';

/** Provides typed operations for RealWorld article endpoints. */
export class ArticlesService {
  constructor(private readonly client = new HttpClient()) {}

  list(query: ArticlesQuery = {}): HttpResponse<ArticlesListResponse> {
    return this.client.get(`/articles${toQuery(query)}`, 'GET /articles', {
      metricGroup: 'article-read',
    });
  }

  feed(
    token: string,
    query: Pick<ArticlesQuery, 'limit' | 'offset'> = {},
  ): HttpResponse<ArticlesListResponse> {
    return this.client.get(`/articles/feed${toQuery(query)}`, 'GET /articles/feed', {
      metricGroup: 'article-read',
      params: auth(token),
    });
  }

  get(slug: string): HttpResponse<ArticleResponse> {
    return this.client.get(`/articles/${encodeURIComponent(slug)}`, 'GET /articles/:slug', {
      metricGroup: 'article-read',
    });
  }

  create(token: string, payload: ArticlePayload): HttpResponse<ArticleResponse> {
    return this.client.post(
      '/articles',
      'POST /articles',
      { article: payload },
      { metricGroup: 'article-write', params: auth(token) },
    );
  }

  update(
    token: string,
    slug: string,
    payload: ArticleUpdatePayload,
  ): HttpResponse<ArticleResponse> {
    return this.client.put(
      `/articles/${encodeURIComponent(slug)}`,
      'PUT /articles/:slug',
      { article: payload },
      { metricGroup: 'article-write', params: auth(token) },
    );
  }

  delete(token: string, slug: string): HttpResponse<EmptyResponse> {
    return this.client.delete(`/articles/${encodeURIComponent(slug)}`, 'DELETE /articles/:slug', {
      metricGroup: 'article-write',
      params: auth(token),
    });
  }

  favorite(token: string, slug: string): HttpResponse<ArticleResponse> {
    return this.client.post(
      `/articles/${encodeURIComponent(slug)}/favorite`,
      'POST /articles/:slug/favorite',
      {},
      { metricGroup: 'article-write', params: auth(token) },
    );
  }

  unfavorite(token: string, slug: string): HttpResponse<ArticleResponse> {
    return this.client.delete(
      `/articles/${encodeURIComponent(slug)}/favorite`,
      'DELETE /articles/:slug/favorite',
      { metricGroup: 'article-write', params: auth(token) },
    );
  }
}
