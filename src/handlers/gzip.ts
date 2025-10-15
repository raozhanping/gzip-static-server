import zlib from 'zlib';
import { IncomingMessage, ServerResponse } from 'http';
import { CompressionResult } from '../types';
import { shouldCompress } from '../utils/mime';

export function acceptsGzip(req: IncomingMessage): boolean {
  const acceptEncoding = req.headers['accept-encoding'] || '';
  return acceptEncoding.includes('gzip');
}

export function compressBuffer(buffer: Buffer, level: number = 6): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    zlib.gzip(buffer, { level }, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}

export async function compressIfNeeded(
  content: Buffer,
  mimeType: string,
  threshold: number = 1024,
  level: number = 6
): Promise<CompressionResult | null> {
  // 检查文件大小是否超过阈值
  if (content.length < threshold) {
    return null;
  }

  // 检查文件类型是否应该压缩
  if (!shouldCompress(mimeType)) {
    return null;
  }

  try {
    const compressed = await compressBuffer(content, level);
    return {
      content: compressed,
      originalSize: content.length,
      compressedSize: compressed.length,
      encoding: 'gzip'
    };
  } catch (error) {
    console.warn('Compression failed:', error);
    return null;
  }
}

export function setCompressionHeaders(
  res: ServerResponse,
  compressionResult: CompressionResult | null,
  etag: string,
  lastModified: string,
  mimeType: string
): void {
  // 设置基本头部
  res.setHeader('Content-Type', mimeType);
  res.setHeader('ETag', etag);
  res.setHeader('Last-Modified', lastModified);
  res.setHeader('Cache-Control', 'public, max-age=3600');

  if (compressionResult) {
    res.setHeader('Content-Encoding', compressionResult.encoding);
    res.setHeader('Content-Length', compressionResult.compressedSize);

    // 添加压缩信息到响应头（开发调试用）
    res.setHeader('X-Compression-Ratio',
      ((1 - compressionResult.compressedSize / compressionResult.originalSize) * 100).toFixed(2) + '%'
    );
  } else {
    // 如果没有压缩，设置原始内容长度（这个会在调用方设置）
    res.setHeader('X-Compression', 'none');
  }
}

export function shouldServeCompressed(req: IncomingMessage, compressionResult: CompressionResult | null): boolean {
  return compressionResult !== null && acceptsGzip(req);
}