import type { Params, Response } from 'k6/http';

export interface User {
  email: string;
  token: string;
  username: string;
  bio: string | null;
  image: string | null;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface RegisterRequest extends LoginRequest {
  username: string;
}

export interface UserResponse {
  user: User;
}

export interface UserUpdatePayload {
  email?: string;
  username?: string;
  password?: string;
  bio?: string;
  image?: string;
}

export type LoginResponse = UserResponse;
export type UserToken = string;

export interface Profile {
  username: string;
  bio: string | null;
  image: string | null;
  following: boolean;
}

export interface Article {
  slug: string;
  title: string;
  description: string;
  body: string;
  tagList: string[];
  createdAt: string;
  updatedAt: string;
  favorited: boolean;
  favoritesCount: number;
  author: Profile;
}

export interface ArticlePayload {
  title: string;
  description: string;
  body: string;
  tagList?: string[];
}

export interface ArticleUpdatePayload {
  title?: string;
  description?: string;
  body?: string;
}

export interface ArticlesQuery {
  tag?: string;
  author?: string;
  favorited?: string;
  limit?: number;
  offset?: number;
}

export interface ArticleResponse {
  article: Article;
}

export interface ArticlesListResponse {
  articles: Article[];
  articlesCount: number;
}

export interface CommentPayload {
  body: string;
}

export interface Comment {
  id: number;
  createdAt: string;
  updatedAt: string;
  body: string;
  author: Profile;
}

export interface CommentResponse {
  comment: Comment;
}

export interface CommentsResponse {
  comments: Comment[];
}

export interface ProfileResponse {
  profile: Profile;
}

export interface TagsResponse {
  tags: string[];
}

export interface ApiErrorResponse {
  errors: Record<string, string[]>;
}

export type EmptyResponse = Record<string, never>;

export type HttpMethod = 'GET' | 'HEAD' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
export type BusinessMetricGroup =
  | 'authentication'
  | 'article-read'
  | 'article-write'
  | 'comment'
  | 'profile'
  | 'tag';

export interface HttpRequestOptions {
  metricGroup?: BusinessMetricGroup;
  params?: Params;
  retryUnsafe?: boolean;
}

export interface HttpResponse<T> {
  data: T | null;
  status: number;
  headers: Record<string, string>;
  raw: Response;
  attempts: number;
}
