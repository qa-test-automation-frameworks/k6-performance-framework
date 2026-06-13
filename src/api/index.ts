import { HttpClient } from '../utils/http-client';
import { ArticlesService } from './articles';
import { AuthService } from './auth';
import { CommentsService } from './comments';
import { ProfilesService } from './profiles';
import { TagsService } from './tags';

export * from './articles';
export * from './auth';
export * from './comments';
export * from './profiles';
export * from './tags';

export interface ApiServices {
  auth: AuthService;
  articles: ArticlesService;
  comments: CommentsService;
  profiles: ProfilesService;
  tags: TagsService;
}

/**
 * Creates API service objects backed by one shared HTTP client.
 * @param client Transport shared by all services.
 * @returns Typed services for the complete RealWorld API surface.
 */
export function createApi(client = new HttpClient()): ApiServices {
  return {
    auth: new AuthService(client),
    articles: new ArticlesService(client),
    comments: new CommentsService(client),
    profiles: new ProfilesService(client),
    tags: new TagsService(client),
  };
}
