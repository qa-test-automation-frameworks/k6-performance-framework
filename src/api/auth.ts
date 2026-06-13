import type {
  HttpResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
  UserUpdatePayload,
} from '../types';
import { HttpClient } from '../utils/http-client';
import type { Params } from 'k6/http';

const envelope = <T>(key: string, value: T): Record<string, T> => ({ [key]: value });

/** Provides typed operations for the RealWorld authentication endpoints. */
export class AuthService {
  constructor(private readonly client = new HttpClient()) {}

  login(payload: LoginRequest): HttpResponse<UserResponse> {
    return this.client.post('/users/login', 'POST /users/login', envelope('user', payload), {
      metricGroup: 'authentication',
    });
  }

  register(payload: RegisterRequest): HttpResponse<UserResponse> {
    return this.client.post('/users', 'POST /users', envelope('user', payload), {
      metricGroup: 'authentication',
    });
  }

  current(token: string): HttpResponse<UserResponse> {
    return this.client.get('/user', 'GET /user', {
      metricGroup: 'authentication',
      params: auth(token),
    });
  }

  update(token: string, payload: UserUpdatePayload): HttpResponse<UserResponse> {
    return this.client.put('/user', 'PUT /user', envelope('user', payload), {
      metricGroup: 'authentication',
      params: auth(token),
    });
  }
}

/**
 * Creates k6 request parameters for token authentication.
 * @param token RealWorld API token.
 * @returns Request parameters containing the authorization header.
 */
export function auth(token: string): Params {
  return { headers: { Authorization: `Token ${token}` } };
}
