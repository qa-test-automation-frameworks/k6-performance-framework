import type { HttpResponse, ProfileResponse } from '../types';
import { HttpClient } from '../utils/http-client';
import { auth } from './auth';

/** Provides typed operations for RealWorld profile endpoints. */
export class ProfilesService {
  constructor(private readonly client = new HttpClient()) {}

  get(username: string, token?: string): HttpResponse<ProfileResponse> {
    return this.client.get(
      `/profiles/${encodeURIComponent(username)}`,
      'GET /profiles/:username',
      token ? { params: auth(token) } : undefined,
    );
  }

  follow(token: string, username: string): HttpResponse<ProfileResponse> {
    return this.client.post(
      `/profiles/${encodeURIComponent(username)}/follow`,
      'POST /profiles/:username/follow',
      {},
      { params: auth(token) },
    );
  }

  unfollow(token: string, username: string): HttpResponse<ProfileResponse> {
    return this.client.delete(
      `/profiles/${encodeURIComponent(username)}/follow`,
      'DELETE /profiles/:username/follow',
      { params: auth(token) },
    );
  }
}
