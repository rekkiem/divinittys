type LogLevel = 'info' | 'warn' | 'error';

function write(level: LogLevel, event: string, data?: Record<string, unknown>) {
  const payload = {
    level,
    event,
    ts: new Date().toISOString(),
    ...data,
  };

  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
    return;
  }
  if (level === 'warn') {
    console.warn(line);
    return;
  }
  console.log(line);
}

export const logger = {
  info: (event: string, data?: Record<string, unknown>) => write('info', event, data),
  warn: (event: string, data?: Record<string, unknown>) => write('warn', event, data),
  error: (event: string, data?: Record<string, unknown>) => write('error', event, data),
};
