import type { HttpResponse, TagsResponse } from '../types';
import { HttpClient } from '../utils/http-client';

export class TagsService {
  constructor(private readonly client = new HttpClient()) {}
  list(): HttpResponse<TagsResponse> {
    return this.client.get('/tags', 'GET /tags');
  }
}
