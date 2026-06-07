import 'server-only';

import fs from 'node:fs';
import path from 'node:path';
import util from 'node:util';

type LogLevel = 'info' | 'warn' | 'error';
type LogData = Record<string, unknown>;

const originalConsole = {
  log: console.log.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

let fileLoggingAvailable: boolean | null = null;
let writingFromLogger = false;

declare global {
  // eslint-disable-next-line no-var
  var __DIVINITTYS_CONSOLE_CAPTURE_INSTALLED__: boolean | undefined;
  // eslint-disable-next-line no-var
  var __DIVINITTYS_PROCESS_LOGGING_INSTALLED__: boolean | undefined;
}

function normalizeDeploymentDate(value?: string): string {
  if (value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString().slice(0, 10);
    }

    const dateMatch = value.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) return dateMatch[0];
  }

  return new Date().toISOString().slice(0, 10);
}

const deploymentDate = normalizeDeploymentDate(
  process.env.LOG_DEPLOYMENT_DATE ||
    process.env.DEPLOYMENT_DATE ||
    process.env.DEPLOYED_AT ||
    process.env.RELEASE_CREATED_AT
);

const deploymentId =
  process.env.LOG_DEPLOYMENT_ID ||
  process.env.RENDER_GIT_COMMIT ||
  process.env.VERCEL_GIT_COMMIT_SHA ||
  process.env.FLY_ALLOC_ID ||
  'local';

function getLogRoot(): string {
  return path.resolve(process.cwd(), process.env.LOG_DIR || 'log');
}

function getDeploymentLogDir(): string {
  return path.join(getLogRoot(), deploymentDate);
}

function isFileLoggingEnabled(): boolean {
  if (process.env.LOG_TO_FILE === 'false') return false;
  if (process.env.NODE_ENV === 'test' && process.env.LOG_TO_FILE !== 'true') return false;
  return process.env.NEXT_RUNTIME !== 'edge';
}

function ensureLogDirectory(): boolean {
  if (!isFileLoggingEnabled()) return false;
  if (fileLoggingAvailable !== null) return fileLoggingAvailable;

  try {
    fs.mkdirSync(getDeploymentLogDir(), { recursive: true });
    fileLoggingAvailable = true;
  } catch (error) {
    fileLoggingAvailable = false;
    originalConsole.warn('[logger] file logging disabled:', error instanceof Error ? error.message : error);
  }

  return fileLoggingAvailable;
}

function serialize(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value instanceof Error) {
    return {
      name: value.name,
      message: value.message,
      stack: value.stack,
      cause: value.cause ? serialize(value.cause, seen) : undefined,
    };
  }

  if (typeof value === 'bigint') return value.toString();
  if (typeof value !== 'object' || value === null) return value;

  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((item) => serialize(item, seen));
  }

  return Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, serialize(item, seen)])
  );
}

function normalizeData(data?: LogData): LogData {
  if (!data) return {};
  return serialize(data) as LogData;
}

function appendLine(fileName: string, line: string, sync = false) {
  if (!ensureLogDirectory()) return;

  const filePath = path.join(getDeploymentLogDir(), fileName);
  if (sync) {
    try {
      fs.appendFileSync(filePath, line, 'utf8');
    } catch (error) {
      fileLoggingAvailable = false;
      originalConsole.warn('[logger] file logging disabled:', error instanceof Error ? error.message : error);
    }
    return;
  }

  fs.promises.appendFile(filePath, line, 'utf8').catch((error) => {
    fileLoggingAvailable = false;
    originalConsole.warn('[logger] file logging disabled:', error instanceof Error ? error.message : error);
  });
}

function writeFiles(level: LogLevel, line: string) {
  const sync = level === 'error';
  appendLine('app.log', line, sync);
  if (level === 'error') appendLine('errors.log', line, true);
}

function emitToConsole(level: LogLevel, line: string) {
  writingFromLogger = true;
  try {
    if (level === 'error') {
      originalConsole.error(line);
      return;
    }
    if (level === 'warn') {
      originalConsole.warn(line);
      return;
    }
    originalConsole.log(line);
  } finally {
    writingFromLogger = false;
  }
}

function write(level: LogLevel, event: string, data?: LogData) {
  const payload = {
    ...normalizeData(data),
    level,
    event,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    deploymentDate,
    deploymentId,
    pid: process.pid,
  };

  const line = `${JSON.stringify(payload)}\n`;
  writeFiles(level, line);
  emitToConsole(level, line.trimEnd());
}

function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => (typeof arg === 'string' ? arg : util.inspect(arg, { depth: 6, breakLength: Infinity })))
    .join(' ');
}

function captureConsole(level: LogLevel, event: string, args: unknown[]) {
  if (writingFromLogger) return;
  const line = `${JSON.stringify({
    level,
    event,
    ts: new Date().toISOString(),
    env: process.env.NODE_ENV || 'development',
    deploymentDate,
    deploymentId,
    pid: process.pid,
    message: formatConsoleArgs(args),
    args: serialize(args),
  })}\n`;
  writeFiles(level, line);
}

export function installGlobalLogCapture() {
  if (process.env.LOG_CONSOLE_CAPTURE === 'false') return;
  if (globalThis.__DIVINITTYS_CONSOLE_CAPTURE_INSTALLED__) return;

  globalThis.__DIVINITTYS_CONSOLE_CAPTURE_INSTALLED__ = true;
  console.log = (...args: unknown[]) => {
    originalConsole.log(...args);
    captureConsole('info', 'console.log', args);
  };
  console.warn = (...args: unknown[]) => {
    originalConsole.warn(...args);
    captureConsole('warn', 'console.warn', args);
  };
  console.error = (...args: unknown[]) => {
    originalConsole.error(...args);
    captureConsole('error', 'console.error', args);
  };
}

export function installProcessErrorLogging() {
  if (globalThis.__DIVINITTYS_PROCESS_LOGGING_INSTALLED__) return;
  globalThis.__DIVINITTYS_PROCESS_LOGGING_INSTALLED__ = true;

  process.on('uncaughtExceptionMonitor', (error) => {
    logger.error('process.uncaught_exception', { error });
  });

  process.on('unhandledRejection', (reason) => {
    logger.error('process.unhandled_rejection', { reason });
  });
}

export const logger = {
  info: (event: string, data?: LogData) => write('info', event, data),
  warn: (event: string, data?: LogData) => write('warn', event, data),
  error: (event: string, data?: LogData) => write('error', event, data),
  deploymentDate,
  getLogDirectory: getDeploymentLogDir,
};
