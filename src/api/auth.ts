import type {
  HttpResponse,
  LoginRequest,
  RegisterRequest,
  UserResponse,
  UserUpdatePayload,
} from '../types';
import { HttpClient } from '../utils/http-client';

const envelope = <T>(key: string, value: T): Record<string, T> => ({ [key]: value });

export class AuthService {
  constructor(private readonly client = new HttpClient()) {}

  login(payload: LoginRequest): HttpResponse<UserResponse> {
    return this.client.post('/users/login', 'POST /users/login', envelope('user', payload));
  }

  register(payload: RegisterRequest): HttpResponse<UserResponse> {
    return this.client.post('/users', 'POST /users', envelope('user', payload));
  }

  current(token: string): HttpResponse<UserResponse> {
    return this.client.get('/user', 'GET /user', { params: auth(token) });
  }

  update(token: string, payload: UserUpdatePayload): HttpResponse<UserResponse> {
    return this.client.put('/user', 'PUT /user', envelope('user', payload), {
      params: auth(token),
    });
  }
}

export function auth(token: string) {
  return { headers: { Authorization: `Token ${token}` } };
}
