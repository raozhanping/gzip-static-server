import { lookup } from 'mime-types';

export function getMimeType(filePath: string): string {
  const mimeType = lookup(filePath);
  return mimeType || 'application/octet-stream';
}

export function shouldCompress(mimeType: string): boolean {
  const compressibleTypes = [
    'text/',
    'application/javascript',
    'application/json',
    'application/xml',
    'application/x-javascript',
    'application/xhtml+xml',
    'image/svg+xml',
    'application/wasm'
  ];

  const nonCompressibleTypes = [
    'image/',
    'video/',
    'audio/',
    'application/pdf',
    'application/zip',
    'application/gzip',
    'application/x-gzip'
  ];

  // 检查是否为不可压缩类型
  for (const type of nonCompressibleTypes) {
    if (mimeType.startsWith(type)) {
      return false;
    }
  }

  // 检查是否为可压缩类型
  for (const type of compressibleTypes) {
    if (mimeType.startsWith(type)) {
      return true;
    }
  }

  return false;
}

export function isTextFile(mimeType: string): boolean {
  return mimeType.startsWith('text/') ||
         mimeType.includes('javascript') ||
         mimeType.includes('json') ||
         mimeType.includes('xml') ||
         mimeType.includes('html') ||
         mimeType.includes('css');
}