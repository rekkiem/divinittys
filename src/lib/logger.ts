/**
 * Logger compartido (Next app + workers tsx).
 * No importar 'server-only': fuera de Next (contenedor workers) no existe
 * el paquete en el grafo de resolución y tira MODULE_NOT_FOUND en bucle.
 * Este módulo solo se usa en rutas server / scripts / workers.
 */

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
  var __divinittysLogCaptureInstalled: boolean | undefined;
  var __divinittysProcessErrorLoggingInstalled: boolean | undefined;
}

function resolveLogDirectory(): string {
  const candidates = [
    process.env.LOG_DIRECTORY,
    process.env.LOG_DIR,
    path.join(process.cwd(), 'log'),
    path.join(process.cwd(), 'logs'),
    '/tmp/divinittys-logs',
  ].filter(Boolean) as string[];

  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-test');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch {
      // try next
    }
  }
  return path.join(process.cwd(), 'log');
}

const LOG_DIRECTORY = resolveLogDirectory();

function todayFile(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return path.join(LOG_DIRECTORY, `${y}-${m}-${day}.log`);
}

function safeSerialize(data: LogData): string {
  try {
    return JSON.stringify({
      ...data,
      ts: data.ts || new Date().toISOString(),
      env: process.env.NODE_ENV || 'development',
      deploymentDate: process.env.DEPLOYMENT_DATE || undefined,
      deploymentId: process.env.DEPLOYMENT_ID || undefined,
      pid: process.pid,
    });
  } catch {
    return JSON.stringify({ level: 'error', event: 'logger.serialize_failed', ts: new Date().toISOString() });
  }
}

function writeLine(level: LogLevel, event: string, data: LogData = {}): void {
  const payload = safeSerialize({ level, event, ...data });
  if (level === 'error') originalConsole.error(payload);
  else if (level === 'warn') originalConsole.warn(payload);
  else originalConsole.log(payload);

  if (writingFromLogger) return;
  writingFromLogger = true;
  try {
    if (fileLoggingAvailable === false) return;
    try {
      fs.appendFileSync(todayFile(), payload + '\n');
      fileLoggingAvailable = true;
    } catch {
      fileLoggingAvailable = false;
    }
  } finally {
    writingFromLogger = false;
  }
}

export const logger = {
  info(event: string, data?: LogData) {
    writeLine('info', event, data || {});
  },
  warn(event: string, data?: LogData) {
    writeLine('warn', event, data || {});
  },
  error(event: string, data?: LogData) {
    writeLine('error', event, data || {});
  },
  getLogDirectory() {
    return LOG_DIRECTORY;
  },
};

export function installGlobalLogCapture(): void {
  if (globalThis.__divinittysLogCaptureInstalled) return;
  globalThis.__divinittysLogCaptureInstalled = true;

  console.log = (...args: unknown[]) => {
    if (writingFromLogger) {
      originalConsole.log(...args);
      return;
    }
    writeLine('info', 'console.log', { message: util.format(...args) });
  };
  console.warn = (...args: unknown[]) => {
    if (writingFromLogger) {
      originalConsole.warn(...args);
      return;
    }
    writeLine('warn', 'console.warn', { message: util.format(...args) });
  };
  console.error = (...args: unknown[]) => {
    if (writingFromLogger) {
      originalConsole.error(...args);
      return;
    }
    writeLine('error', 'console.error', { message: util.format(...args) });
  };
}

export function installProcessErrorLogging(): void {
  if (globalThis.__divinittysProcessErrorLoggingInstalled) return;
  globalThis.__divinittysProcessErrorLoggingInstalled = true;

  process.on('uncaughtException', (err) => {
    writeLine('error', 'process.uncaughtException', {
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
  });
  process.on('unhandledRejection', (reason) => {
    writeLine('error', 'process.unhandledRejection', {
      error: reason instanceof Error ? reason.message : String(reason),
      stack: reason instanceof Error ? reason.stack : undefined,
    });
  });
}
