import fs from 'fs';
import path from 'path';
import { IncomingMessage, ServerResponse } from 'http';
import url from 'url';
import { FileInfo } from '../types';
import { getMimeType } from '../utils/mime';
import { MemoryCache } from '../utils/cache';
import { compressIfNeeded, setCompressionHeaders, shouldServeCompressed } from './gzip';

export class StaticFileHandler {
  private cache: MemoryCache;
  private rootDir: string;
  private indexPath: string;

  constructor(rootDir: string, cacheSize: number = 100 * 1024 * 1024, indexPath: string = 'index.html') {
    this.rootDir = path.resolve(rootDir);
    this.cache = new MemoryCache(cacheSize);
    this.indexPath = indexPath;
  }

  private sanitizePath(requestPath: string): string {
    // 解析 URL
    const parsedUrl = url.parse(requestPath, true);
    let pathname = parsedUrl.pathname || '/';

    // 标准化路径
    if (pathname === '/') {
      pathname = '/' + this.indexPath;
    }

    // 移除查询参数
    pathname = pathname.split('?')[0];

    // 解码 URI 组件
    pathname = decodeURIComponent(pathname);

    // 确保路径以 / 开头
    if (!pathname.startsWith('/')) {
      pathname = '/' + pathname;
    }

    return pathname;
  }

  private getFileInfo(filePath: string): FileInfo | null {
    try {
      const fullPath = path.join(this.rootDir, filePath);
      const stat = fs.statSync(fullPath);

      if (!stat.isFile()) {
        return null;
      }

      // 安全检查：确保文件在根目录内
      const relativePath = path.relative(this.rootDir, fullPath);
      if (relativePath.startsWith('..')) {
        return null;
      }

      const mimeType = getMimeType(fullPath);
      const shouldCompress = this.shouldCompressFile(mimeType, stat.size);

      return {
        path: fullPath,
        size: stat.size,
        mtime: stat.mtime,
        etag: this.generateETag(stat),
        mimeType,
        shouldCompress
      };
    } catch (error) {
      return null;
    }
  }

  private generateETag(stat: fs.Stats): string {
    return `"${stat.size}-${stat.mtime.getTime()}"`;
  }

  private shouldCompressFile(mimeType: string, size: number): boolean {
    const compressibleTypes = [
      'text/',
      'application/javascript',
      'application/json',
      'application/xml',
      'application/x-javascript',
      'application/xhtml+xml',
      'image/svg+xml'
    ];

    const nonCompressibleTypes = [
      'image/',
      'video/',
      'audio/',
      'application/pdf',
      'application/zip',
      'application/gzip'
    ];

    // 检查是否为不可压缩类型
    for (const type of nonCompressibleTypes) {
      if (mimeType.startsWith(type)) {
        return false;
      }
    }

    // 检查是否为可压缩类型且大小合适
    for (const type of compressibleTypes) {
      if (mimeType.startsWith(type) && size > 1024) { // 只压缩大于 1KB 的文件
        return true;
      }
    }

    return false;
  }

  private sendError(res: ServerResponse, statusCode: number, message: string): void {
    res.writeHead(statusCode, { 'Content-Type': 'text/plain' });
    res.end(message);
  }

  private async handleFileRequest(
    req: IncomingMessage,
    res: ServerResponse,
    filePath: string
  ): Promise<void> {
    try {
      const fileInfo = this.getFileInfo(filePath);
      if (!fileInfo) {
        this.sendError(res, 404, 'File not found');
        return;
      }

      // 检查缓存
      const cacheEntry = this.cache.get(fileInfo.path);
      let content: Buffer;
      let compressed: Buffer | undefined;

      if (cacheEntry && !this.cache.isModified(fileInfo.path, fileInfo.mtime.getTime())) {
        // 缓存命中
        content = cacheEntry.content;
        compressed = cacheEntry.compressed;
      } else {
        // 缓存未命中，读取文件
        content = fs.readFileSync(fileInfo.path);

        // 如果需要压缩，进行压缩
        if (fileInfo.shouldCompress) {
          try {
            compressed = await this.compressContent(content);
          } catch (error) {
            console.warn('Compression failed:', error);
          }
        }

        // 更新缓存
        this.cache.set(fileInfo.path, content, fileInfo.mimeType, compressed);
      }

      // 检查 ETag 匹配
      const ifNoneMatch = req.headers['if-none-match'];
      if (ifNoneMatch && ifNoneMatch === fileInfo.etag) {
        res.writeHead(304);
        res.end();
        return;
      }

      // 检查 Last-Modified
      const ifModifiedSince = req.headers['if-modified-since'];
      if (ifModifiedSince && ifModifiedSince === fileInfo.mtime.toUTCString()) {
        res.writeHead(304);
        res.end();
        return;
      }

      // 决定是否发送压缩内容
      const compressionResult = compressed ? {
        content: compressed,
        originalSize: content.length,
        compressedSize: compressed.length,
        encoding: 'gzip'
      } : null;

      const shouldSendCompressed = shouldServeCompressed(req, compressionResult);
      const finalContent = shouldSendCompressed && compressed ? compressed : content;

      // 设置响应头
      setCompressionHeaders(
        res,
        compressionResult,
        fileInfo.etag,
        fileInfo.mtime.toUTCString(),
        fileInfo.mimeType
      );

      // 设置正确的内容长度
      res.setHeader('Content-Length', finalContent.length);

      // 发送内容
      res.writeHead(200);
      res.end(finalContent);

    } catch (error) {
      console.error('Error serving file:', error);
      this.sendError(res, 500, 'Internal server error');
    }
  }

  private async compressContent(content: Buffer): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const zlib = require('zlib');
      zlib.gzip(content, { level: 6 }, (err: Error | null, result: Buffer) => {
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  public async handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const requestPath = req.url || '/';
    const sanitizedPath = this.sanitizePath(requestPath);

    // 移除开头的 /
    const filePath = sanitizedPath.slice(1);

    await this.handleFileRequest(req, res, filePath);
  }

  public clearCache(): void {
    this.cache.clear();
  }

  public getCacheStats() {
    return this.cache.getStats();
  }
}