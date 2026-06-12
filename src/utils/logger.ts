export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const priorities: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function configuredLevel(): LogLevel {
  const level = (__ENV.LOG_LEVEL ?? 'info').toLowerCase();
  return level in priorities ? (level as LogLevel) : 'info';
}

function redact(value: unknown, key = ''): unknown {
  if (/authorization|token|password/i.test(key)) {
    return '[REDACTED]';
  }
  if (Array.isArray(value)) {
    return value.map((item) => redact(item));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([entryKey, entryValue]) => [
        entryKey,
        redact(entryValue, entryKey),
      ]),
    );
  }
  return value;
}

function write(level: LogLevel, message: string, context?: Record<string, unknown>): void {
  if (priorities[level] < priorities[configuredLevel()]) {
    return;
  }

  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(context ? { context: redact(context) } : {}),
  });

  if (level === 'error') console.error(entry);
  else if (level === 'warn') console.warn(entry);
  else if (level === 'debug') console.debug(entry);
  else console.log(entry);
}

export const logger = {
  debug: (message: string, context?: Record<string, unknown>): void =>
    write('debug', message, context),
  info: (message: string, context?: Record<string, unknown>): void =>
    write('info', message, context),
  warn: (message: string, context?: Record<string, unknown>): void =>
    write('warn', message, context),
  error: (message: string, context?: Record<string, unknown>): void =>
    write('error', message, context),
};
