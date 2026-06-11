import { afterEach, describe, expect, it, vi } from 'vitest';
import { sleep } from 'k6';
import http from 'k6/http';
import { HttpClient } from '../../src/utils/http-client';
import type { EnvConfig } from '../../src/types/config.types';
import { setTestEnv } from './setup';

const config: EnvConfig = {
  environment: 'staging',
  baseUrl: 'https://example.test/api/',
  timeouts: { http: 5_000, connect: 1_000 },
  rps: { target: 1, max: 2 },
  tags: { env: 'staging', app: 'conduit' },
  readOnly: false,
};

function response(status: number, data: unknown = { ok: true }) {
  return {
    status,
    body: JSON.stringify(data),
    headers: { 'Content-Type': 'application/json' },
    json: () => data,
  };
}

describe('HttpClient', () => {
  afterEach(() => {
    vi.clearAllMocks();
    setTestEnv({});
  });

  it('joins URLs and applies required request tags', () => {
    vi.mocked(http.request).mockReturnValue(response(200) as never);
    const result = new HttpClient(config).get<{ ok: boolean }>('/tags', 'GET /tags');

    expect(http.request).toHaveBeenCalledWith(
      'GET',
      'https://example.test/api/tags',
      null,
      expect.objectContaining({
        tags: { env: 'staging', app: 'conduit', name: 'GET /tags' },
      }),
    );
    expect(result.data).toEqual({ ok: true });
  });

  it('retries a safe method once after a 5xx', () => {
    vi.mocked(http.request)
      .mockReturnValueOnce(response(503) as never)
      .mockReturnValueOnce(response(200) as never);

    const result = new HttpClient(config).get('/tags', 'GET /tags');

    expect(result.attempts).toBe(2);
    expect(sleep).toHaveBeenCalledWith(0.1);
  });

  it('does not retry POST unless explicitly enabled', () => {
    vi.mocked(http.request).mockReturnValue(response(503) as never);
    const client = new HttpClient(config);

    expect(client.post('/articles', 'POST /articles', {}).attempts).toBe(1);
    expect(
      client.post('/articles', 'POST /articles', {}, { retryUnsafe: true }).attempts,
    ).toBe(2);
  });

  it('does not retry a 4xx response', () => {
    vi.mocked(http.request).mockReturnValue(response(400) as never);
    expect(new HttpClient(config).get('/tags', 'GET /tags').attempts).toBe(1);
  });

  it('blocks writes in read-only production configuration', () => {
    const production = { ...config, environment: 'production', readOnly: true } as EnvConfig;
    expect(() => new HttpClient(production).delete('/articles/test', 'DELETE /articles/:slug'))
      .toThrow('blocked in the production environment');
  });
});
