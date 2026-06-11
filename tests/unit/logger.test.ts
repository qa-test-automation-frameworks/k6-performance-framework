import { afterEach, describe, expect, it, vi } from 'vitest';
import { logger } from '../../src/utils/logger';
import { setTestEnv } from './setup';

describe('logger', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    setTestEnv({});
  });

  it('suppresses debug logs at the default info level', () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    logger.debug('hidden');
    expect(debug).not.toHaveBeenCalled();
  });

  it('writes structured logs and redacts secrets', () => {
    setTestEnv({ LOG_LEVEL: 'debug' });
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    logger.debug('request', { authorization: 'Bearer secret', nested: { token: 'secret' } });

    const entry = JSON.parse(String(debug.mock.calls[0][0])) as {
      level: string;
      context: { authorization: string; nested: { token: string } };
    };
    expect(entry.level).toBe('debug');
    expect(entry.context.authorization).toBe('[REDACTED]');
    expect(entry.context.nested.token).toBe('[REDACTED]');
  });
});
