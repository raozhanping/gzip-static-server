import chokidar from 'chokidar';
import { EventEmitter } from 'events';
import { Logger } from '../types';

export interface WatcherOptions {
  ignored?: string[];
  ignoreInitial?: boolean;
  usePolling?: boolean;
  interval?: number;
}

export class FileWatcher extends EventEmitter {
  private watcher: chokidar.FSWatcher | null = null;
  private logger: Logger;

  constructor(logger: Logger) {
    super();
    this.logger = logger;
  }

  public start(paths: string | string[], options: WatcherOptions = {}): void {
    this.stop(); // 停止之前的监听

    const defaultOptions: WatcherOptions = {
      ignored: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.git/**'
      ],
      ignoreInitial: true,
      usePolling: false,
      interval: 100,
      ...options
    };

    this.watcher = chokidar.watch(paths, defaultOptions);

    this.watcher
      .on('ready', () => {
        this.logger.info('File watcher ready');
      })
      .on('add', (path) => {
        this.logger.debug(`File added: ${path}`);
        this.emit('change', path);
      })
      .on('change', (path) => {
        this.logger.debug(`File changed: ${path}`);
        this.emit('change', path);
      })
      .on('unlink', (path) => {
        this.logger.debug(`File removed: ${path}`);
        this.emit('unlink', path);
      })
      .on('addDir', (path) => {
        this.logger.debug(`Directory added: ${path}`);
        this.emit('change', path);
      })
      .on('unlinkDir', (path) => {
        this.logger.debug(`Directory removed: ${path}`);
        this.emit('change', path);
      })
      .on('error', (error) => {
        this.logger.error('File watcher error:', error);
      });

    this.logger.info(`Watching for file changes in: ${Array.isArray(paths) ? paths.join(', ') : paths}`);
  }

  public stop(): void {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
      this.logger.info('File watcher stopped');
    }
  }

  public isRunning(): boolean {
    return this.watcher !== null;
  }
}