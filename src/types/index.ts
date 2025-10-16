import { IncomingMessage, ServerResponse } from 'http';

export interface ServerConfig {
  port: number;
  host: string;
  rootDir: string;
  uploadDir?: string;
  gzip: boolean;
  gzipLevel: number;
  gzipThreshold: number;
  cache: boolean;
  cacheMaxAge: number;
  watch: boolean;
  open: boolean;
  logLevel: 'debug' | 'info' | 'warn' | 'error';
  cors: boolean;
  indexPath: string;
}

export interface CompressionResult {
  content: Buffer;
  originalSize: number;
  compressedSize: number;
  encoding: string;
}

export interface FileInfo {
  path: string;
  size: number;
  mtime: Date;
  etag: string;
  mimeType: string;
  shouldCompress: boolean;
}

export interface RequestHandler {
  (req: IncomingMessage, res: ServerResponse): void | Promise<void>;
}

export interface CacheEntry {
  content: Buffer;
  compressed?: Buffer;
  etag: string;
  lastModified: string;
  mimeType: string;
  mtime: number;
}

export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, error?: Error, ...args: any[]): void;
}

export interface ServerStats {
  requests: number;
  bytesTransferred: number;
  bytesSaved: number;
  cacheHits: number;
  cacheMisses: number;
  startTime: Date;
}