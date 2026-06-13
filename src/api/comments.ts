import type {
  CommentPayload,
  CommentResponse,
  CommentsResponse,
  EmptyResponse,
  HttpResponse,
} from '../types';
import { HttpClient } from '../utils/http-client';
import { auth } from './auth';

/** Provides typed operations for RealWorld comment endpoints. */
export class CommentsService {
  constructor(private readonly client = new HttpClient()) {}

  list(slug: string): HttpResponse<CommentsResponse> {
    return this.client.get(
      `/articles/${encodeURIComponent(slug)}/comments`,
      'GET /articles/:slug/comments',
    );
  }

  create(token: string, slug: string, payload: CommentPayload): HttpResponse<CommentResponse> {
    return this.client.post(
      `/articles/${encodeURIComponent(slug)}/comments`,
      'POST /articles/:slug/comments',
      { comment: payload },
      { params: auth(token) },
    );
  }

  delete(token: string, slug: string, id: number): HttpResponse<EmptyResponse> {
    return this.client.delete(
      `/articles/${encodeURIComponent(slug)}/comments/${id}`,
      'DELETE /articles/:slug/comments/:id',
      { params: auth(token) },
    );
  }
}
