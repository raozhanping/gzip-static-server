import chalk from 'chalk';
import { Logger } from '../types';

class ColoredLogger implements Logger {
  private level: 'debug' | 'info' | 'warn' | 'error';
  private levels = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
  };

  constructor(level: 'debug' | 'info' | 'warn' | 'error' = 'info') {
    this.level = level;
  }

  private shouldLog(level: 'debug' | 'info' | 'warn' | 'error'): boolean {
    return this.levels[level] >= this.levels[this.level];
  }

  private formatMessage(level: string, message: string): string {
    const timestamp = new Date().toISOString();
    const levelColors = {
      debug: chalk.gray,
      info: chalk.blue,
      warn: chalk.yellow,
      error: chalk.red
    };

    const colorFn = levelColors[level as keyof typeof levelColors];
    return `${chalk.gray(timestamp)} ${colorFn(`[${level.toUpperCase()}]`)} ${message}`;
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(this.formatMessage('debug', message), ...args);
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(this.formatMessage('info', message), ...args);
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(this.formatMessage('warn', message), ...args);
    }
  }

  error(message: string, error?: Error, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(this.formatMessage('error', message));
      if (error) {
        console.error(chalk.red(error.stack || error.message));
      }
      if (args.length > 0) {
        console.error(...args);
      }
    }
  }
}

export function createLogger(level: 'debug' | 'info' | 'warn' | 'error' = 'info'): Logger {
  return new ColoredLogger(level);
}

export { ColoredLogger };