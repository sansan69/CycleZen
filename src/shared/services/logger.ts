/**
 * Environment-aware logger service.
 * In production: suppresses debug/info, only allows warn/error.
 * In development: logs everything.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const isProduction = process.env.NODE_ENV === 'production';
const SUPPRESSED_IN_PRODUCTION: LogLevel[] = ['debug', 'info'];

function formatTimestamp(): string {
  return new Date().toISOString();
}

function shouldLog(level: LogLevel): boolean {
  if (isProduction && SUPPRESSED_IN_PRODUCTION.includes(level)) {
    return false;
  }
  return true;
}

function log(level: LogLevel, module: string, message: string, ...args: unknown[]): void {
  if (!shouldLog(level)) return;

  const prefix = `[CycleZen] ${formatTimestamp()} [${module}]`;
  const consoleMethod = console[level] as (...args: unknown[]) => void;

  if (args.length > 0) {
    consoleMethod(`${prefix} ${message}`, ...args);
  } else {
    consoleMethod(`${prefix} ${message}`);
  }
}

export const logger = {
  debug(module: string, message: string, ...args: unknown[]): void {
    log('debug', module, message, ...args);
  },

  info(module: string, message: string, ...args: unknown[]): void {
    log('info', module, message, ...args);
  },

  warn(module: string, message: string, ...args: unknown[]): void {
    log('warn', module, message, ...args);
  },

  error(module: string, message: string, ...args: unknown[]): void {
    log('error', module, message, ...args);
  },
};
