import { createServer, Server, IncomingMessage, ServerResponse } from 'http';
import { ServerConfig, Logger, ServerStats, RequestHandler } from './types';
import { StaticFileHandler } from './handlers/static';
import { FileWatcher } from './utils/watcher';
import { createLogger } from './utils/logger';

export class GzipStaticServer {
  private server: Server | null = null;
  private config: ServerConfig;
  private logger: Logger;
  private fileHandler: StaticFileHandler;
  private fileWatcher: FileWatcher | null = null;
  private stats: ServerStats;
  private middleware: RequestHandler[] = [];

  constructor(config: ServerConfig) {
    this.config = config;
    this.logger = createLogger(config.logLevel);
    this.fileHandler = new StaticFileHandler(
      config.rootDir,
      100 * 1024 * 1024, // 100MB cache
      config.indexPath
    );

    this.stats = {
      requests: 0,
      bytesTransferred: 0,
      bytesSaved: 0,
      cacheHits: 0,
      cacheMisses: 0,
      startTime: new Date()
    };

    if (config.watch) {
      this.fileWatcher = new FileWatcher(this.logger);
      this.setupFileWatcher();
    }
  }

  private setupFileWatcher(): void {
    if (!this.fileWatcher) return;

    this.fileWatcher.on('change', (path: string) => {
      this.logger.info(`File changed: ${path}`);
      // 清除相关缓存
      this.fileHandler.clearCache();
      // 可以在这里添加浏览器刷新等逻辑
    });

    this.fileWatcher.start(this.config.rootDir, {
      ignored: [
        '**/node_modules/**'
      ]
    });
  }

  private addMiddleware(handler: RequestHandler): void {
    this.middleware.push(handler);
  }

  private setupCors(req: IncomingMessage, res: ServerResponse): void {
    if (!this.config.cors) return;

    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Accept-Encoding, If-None-Match, If-Modified-Since');

    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }
  }

  private async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const startTime = Date.now();
    this.stats.requests++;

    try {
      // 设置 CORS 头部
      this.setupCors(req, res);

      // 安全头部
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('X-Frame-Options', 'DENY');
      res.setHeader('X-XSS-Protection', '1; mode=block');

      // 服务器信息头部
      res.setHeader('Server', 'Gzip-Static-Server/1.0.0');

      // 执行中间件
      for (const middleware of this.middleware) {
        await middleware(req, res);
      }

      // 处理静态文件
      if (req.method === 'GET' || req.method === 'HEAD') {
        await this.fileHandler.handleRequest(req, res);
      } else {
        res.writeHead(405, { 'Allow': 'GET, HEAD, OPTIONS' });
        res.end('Method Not Allowed');
      }

    } catch (error) {
      this.logger.error('Request handling error:', error as Error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal Server Error');
    } finally {
      const duration = Date.now() - startTime;
      const url = req.url || '/';
      const method = req.method || 'GET';

      this.logger.info(`${method} ${url} - ${res.statusCode} - ${duration}ms`);
    }
  }

  public async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = createServer((req, res) => {
        this.handleRequest(req, res).catch(error => {
          this.logger.error('Unhandled request error:', error);
          if (!res.headersSent) {
            res.writeHead(500);
            res.end('Internal Server Error');
          }
        });
      });

      this.server.on('error', (error) => {
        this.logger.error('Server error:', error);
        reject(error);
      });

      this.server.listen(this.config.port, this.config.host, () => {
        const address = this.server!.address();
        const host = typeof address === 'string' ? address : `${address?.address}:${address?.port}`;
        this.logger.info(`🚀 Gzip Static Server running at http://${host}`);
        this.logger.info(`📁 Serving files from: ${this.config.rootDir}`);
        this.logger.info(`🗜️  Gzip compression: ${this.config.gzip ? 'enabled' : 'disabled'}`);
        this.logger.info(`💾 Caching: ${this.config.cache ? 'enabled' : 'disabled'}`);
        this.logger.info(`👀 File watching: ${this.config.watch ? 'enabled' : 'disabled'}`);

        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (this.fileWatcher) {
        this.fileWatcher.stop();
      }

      if (this.server) {
        this.server.close(() => {
          this.logger.info('Server stopped');
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  public getStats(): ServerStats & { uptime: number; cacheStats: any } {
    return {
      ...this.stats,
      uptime: Date.now() - this.stats.startTime.getTime(),
      cacheStats: this.fileHandler.getCacheStats()
    };
  }

  public getLogger(): Logger {
    return this.logger;
  }

  public getConfig(): ServerConfig {
    return this.config;
  }
}