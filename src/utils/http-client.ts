import { sleep } from 'k6';
import http, { type Params, type RequestBody, type Response } from 'k6/http';
import { getConfig } from '../../config';
import type { HttpMethod, HttpRequestOptions, HttpResponse } from '../types/api.types';
import type { BusinessMetricGroup } from '../types/api.types';
import type { EnvConfig } from '../types/config.types';
import { logger } from './logger';
import {
  articleReadDuration,
  articleReadSuccessRate,
  articleWriteDuration,
  articleWriteSuccessRate,
  authDuration,
  authSuccessRate,
  commentDuration,
  commentSuccessRate,
  profileDuration,
  profileSuccessRate,
  tagDuration,
  tagSuccessRate,
  totalBusinessErrors,
} from './metrics';

const safeRetryMethods = new Set<HttpMethod>(['GET', 'HEAD', 'PUT', 'DELETE']);
const writeMethods = new Set<HttpMethod>(['POST', 'PUT', 'PATCH', 'DELETE']);

function joinUrl(baseUrl: string, path: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}

function parseJson<T>(response: Response): T | null {
  if (!response.body) return null;
  try {
    return response.json() as T;
  } catch {
    return null;
  }
}

const metricRecorders: Record<
  BusinessMetricGroup,
  { duration: typeof authDuration; success: typeof authSuccessRate }
> = {
  authentication: { duration: authDuration, success: authSuccessRate },
  'article-read': { duration: articleReadDuration, success: articleReadSuccessRate },
  'article-write': { duration: articleWriteDuration, success: articleWriteSuccessRate },
  comment: { duration: commentDuration, success: commentSuccessRate },
  profile: { duration: profileDuration, success: profileSuccessRate },
  tag: { duration: tagDuration, success: tagSuccessRate },
};

function recordBusinessMetrics(
  endpointName: string,
  metricGroup: BusinessMetricGroup | undefined,
  response: Response,
): void {
  const duration = response.timings.duration;
  if (metricGroup) {
    const recorder = metricRecorders[metricGroup];
    recorder.duration.add(duration, { endpoint: endpointName });
    recorder.success.add(response.status >= 200 && response.status < 400, {
      endpoint: endpointName,
    });
  }
  if (response.status >= 400) {
    totalBusinessErrors.add(1, { endpoint: endpointName, status: String(response.status) });
  }
}

/** Shared tagged HTTP transport with target safety, retries, and business metric recording. */
export class HttpClient {
  constructor(private readonly config: EnvConfig = getConfig()) {}

  request<T>(
    method: HttpMethod,
    path: string,
    endpointName: string,
    body?: unknown,
    options: HttpRequestOptions = {},
  ): HttpResponse<T> {
    if (this.config.readOnly && writeMethods.has(method)) {
      throw new Error(`${method} requests are blocked in the production environment`);
    }

    const url = joinUrl(this.config.baseUrl, path);
    const params: Params = {
      ...options.params,
      timeout: options.params?.timeout ?? this.config.timeouts.http,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
        ...options.params?.headers,
      },
      tags: {
        ...this.config.tags,
        ...options.params?.tags,
        name: endpointName,
      },
    };
    const requestBody: RequestBody | null =
      body === undefined ? null : typeof body === 'string' ? body : JSON.stringify(body);
    const retry = safeRetryMethods.has(method) || options.retryUnsafe === true;
    let attempts = 0;
    let response: Response;

    do {
      attempts += 1;
      logger.debug('HTTP request', { method, url, tags: params.tags, attempt: attempts });
      response = http.request(method, url, requestBody, params);
      recordBusinessMetrics(endpointName, options.metricGroup, response);
      logger.debug('HTTP response', { method, url, status: response.status, attempt: attempts });

      if (!(retry && attempts === 1 && response.status >= 500)) break;
      sleep(0.1);
    } while (attempts < 2);

    return {
      data: parseJson<T>(response),
      status: response.status,
      headers: response.headers,
      raw: response,
      attempts,
    };
  }

  get<T>(path: string, name: string, options?: HttpRequestOptions): HttpResponse<T> {
    return this.request<T>('GET', path, name, undefined, options);
  }

  post<T>(
    path: string,
    name: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): HttpResponse<T> {
    return this.request<T>('POST', path, name, body, options);
  }

  put<T>(path: string, name: string, body: unknown, options?: HttpRequestOptions): HttpResponse<T> {
    return this.request<T>('PUT', path, name, body, options);
  }

  patch<T>(
    path: string,
    name: string,
    body: unknown,
    options?: HttpRequestOptions,
  ): HttpResponse<T> {
    return this.request<T>('PATCH', path, name, body, options);
  }

  delete<T>(path: string, name: string, options?: HttpRequestOptions): HttpResponse<T> {
    return this.request<T>('DELETE', path, name, undefined, options);
  }
}
