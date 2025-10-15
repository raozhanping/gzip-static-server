import crypto from 'crypto';
import { CacheEntry } from '../types';

export class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private maxSize: number;
  private currentSize = 0;

  constructor(maxSize: number = 100 * 1024 * 1024) { // 默认 100MB
    this.maxSize = maxSize;
  }

  private generateETag(content: Buffer): string {
    return `"${crypto.createHash('md5').update(content).digest('hex')}"`;
  }

  private calculateSize(entry: CacheEntry): number {
    return entry.content.length + (entry.compressed?.length || 0);
  }

  private evictOldest(): void {
    // 简单的 LRU 实现：删除第一个条目
    const firstKey = this.cache.keys().next().value;
    if (firstKey) {
      const entry = this.cache.get(firstKey)!;
      this.currentSize -= this.calculateSize(entry);
      this.cache.delete(firstKey);
    }
  }

  get(path: string): CacheEntry | null {
    const entry = this.cache.get(path);
    if (entry) {
      // 移动到最后（LRU）
      this.cache.delete(path);
      this.cache.set(path, entry);
      return entry;
    }
    return null;
  }

  set(path: string, content: Buffer, mimeType: string, compressed?: Buffer): void {
    const stat = require('fs').statSync(path);
    const entry: CacheEntry = {
      content,
      compressed,
      etag: this.generateETag(content),
      lastModified: stat.mtime.toUTCString(),
      mimeType,
      mtime: stat.mtime.getTime()
    };

    const entrySize = this.calculateSize(entry);

    // 如果单个文件超过缓存大小限制，不缓存
    if (entrySize > this.maxSize) {
      return;
    }

    // 如果已存在，先删除旧的
    if (this.cache.has(path)) {
      const oldEntry = this.cache.get(path)!;
      this.currentSize -= this.calculateSize(oldEntry);
    }

    // 确保有足够空间
    while (this.currentSize + entrySize > this.maxSize && this.cache.size > 0) {
      this.evictOldest();
    }

    this.cache.set(path, entry);
    this.currentSize += entrySize;
  }

  delete(path: string): void {
    const entry = this.cache.get(path);
    if (entry) {
      this.currentSize -= this.calculateSize(entry);
      this.cache.delete(path);
    }
  }

  clear(): void {
    this.cache.clear();
    this.currentSize = 0;
  }

  // 检查文件是否已修改
  isModified(path: string, mtime: number): boolean {
    const entry = this.cache.get(path);
    return !entry || entry.mtime !== mtime;
  }

  getStats(): { size: number; count: number; maxSize: number } {
    return {
      size: this.currentSize,
      count: this.cache.size,
      maxSize: this.maxSize
    };
  }
}