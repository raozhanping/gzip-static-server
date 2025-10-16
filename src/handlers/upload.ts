import { IncomingMessage, ServerResponse } from 'http';
import { existsSync, mkdirSync, statSync, readdirSync, createReadStream, createWriteStream, unlinkSync } from 'fs';
import { join, extname, basename } from 'path';
import { createGzip } from 'zlib';
import { pipeline } from 'stream';
import { Formidable } from 'formidable';
import { Logger } from '../types';

export interface UploadResult {
  success: boolean;
  filename: string;
  originalName: string;
  size: number;
  gzipSize?: number;
  compressionRatio?: number;
  message?: string;
}

export interface FileList {
  files: Array<{
    filename: string;
    originalName: string;
    size: number;
    gzipSize: number;
    compressionRatio: number;
    uploadTime: string;
  }>;
}

export class UploadHandler {
  private uploadDir: string;
  private logger: Logger;

  constructor(uploadDir: string, logger: Logger) {
    this.uploadDir = uploadDir;
    this.logger = logger;
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!existsSync(this.uploadDir)) {
      mkdirSync(this.uploadDir, { recursive: true });
      this.logger.info(`Created upload directory: ${this.uploadDir}`);
    }
  }

  private async createGzipVersion(filePath: string): Promise<{ size: number; ratio: number }> {
    return new Promise((resolve, reject) => {
      const gzipPath = `${filePath}.gz`;
      const gzip = createGzip({ level: 6 });
      const input = createReadStream(filePath);
      const output = createWriteStream(gzipPath);

      pipeline(
        input,
        gzip,
        output,
        (err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            // 压缩完成后，获取实际文件大小
            try {
              const stats = statSync(gzipPath);
              const originalStats = statSync(filePath);
              const compressedSize = stats.size;
              const originalSize = originalStats.size;
              const ratio = originalSize > 0 ? Math.round((1 - compressedSize / originalSize) * 100) : 0;
              resolve({ size: compressedSize, ratio });
            } catch (statError) {
              reject(statError);
            }
          }
        }
      );
    });
  }

  
  private generateUniqueFilename(originalName: string): string {
    // 如果文件不存在，直接使用原始文件名
    const filePath = join(this.uploadDir, originalName);
    if (!existsSync(filePath)) {
      return originalName;
    }

    // 如果文件存在，添加序号
    const ext = extname(originalName);
    const nameWithoutExt = basename(originalName, ext);
    let counter = 1;

    while (true) {
      const newFilename = `${nameWithoutExt}_${counter}${ext}`;
      const newPath = join(this.uploadDir, newFilename);
      if (!existsSync(newPath)) {
        return newFilename;
      }
      counter++;
    }
  }

  private async handleSingleFile(file: any): Promise<UploadResult> {
    try {
      // 保留原始文件名，但处理冲突
      const originalName = file.originalFilename || 'unknown';
      const uniqueFilename = this.generateUniqueFilename(originalName);
      const targetPath = join(this.uploadDir, uniqueFilename);

      // 移动文件到目标位置
      await new Promise<void>((resolve, reject) => {
        const readStream = createReadStream(file.filepath);
        const writeStream = createWriteStream(targetPath);

        pipeline(readStream, writeStream, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });

      // 获取文件大小
      const stats = statSync(targetPath);
      const fileSize = stats.size;

      // 创建gzip版本
      let gzipSize = 0;
      let compressionRatio = 0;

      try {
        const gzipResult = await this.createGzipVersion(targetPath);
        gzipSize = gzipResult.size;
        compressionRatio = gzipResult.ratio;

        this.logger.info(`File uploaded and compressed: ${uniqueFilename} (${fileSize} bytes -> ${gzipSize} bytes, ${compressionRatio}% saved)`);
      } catch (gzipError) {
        this.logger.warn(`Gzip compression failed for ${uniqueFilename}:`, gzipError as Error);
      }

      // 清理formidable的临时文件
      try {
        unlinkSync(file.filepath);
      } catch (cleanupError) {
        this.logger.warn(`Failed to cleanup temp file ${file.filepath}:`, cleanupError as Error);
      }

      return {
        success: true,
        filename: uniqueFilename,
        originalName,
        size: fileSize,
        gzipSize,
        compressionRatio
      };

    } catch (error) {
      this.logger.error('File upload error:', error as Error);

      // 确保清理临时文件，即使出错也要清理
      try {
        unlinkSync(file.filepath);
      } catch (cleanupError) {
        // 忽略清理错误
      }

      return {
        success: false,
        filename: '',
        originalName: file.originalFilename || 'unknown',
        size: 0,
        message: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  public async handleUpload(req: IncomingMessage, res: ServerResponse): Promise<void> {
    // 设置响应头
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    try {
      const form = new Formidable({
        uploadDir: this.uploadDir,
        keepExtensions: true,
        maxFileSize: 100 * 1024 * 1024, // 100MB
        multiples: true
      });

      const [fields, files] = await form.parse(req);
      const uploadedFiles = Array.isArray(files.files) ? files.files : [files.files].filter(Boolean);
      const results: UploadResult[] = [];

      for (const file of uploadedFiles) {
        const result = await this.handleSingleFile(file);
        results.push(result);
      }

      const successCount = results.filter(r => r.success).length;
      const response = {
        success: successCount > 0,
        message: `${successCount}/${results.length} files uploaded successfully`,
        results
      };

      res.writeHead(200);
      res.end(JSON.stringify(response, null, 2));

    } catch (error) {
      this.logger.error('Upload handling error:', error as Error);

      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        message: 'Upload failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }

  public async handleFileList(req: IncomingMessage, res: ServerResponse): Promise<void> {
    try {
      const fileList: FileList['files'] = [];

      // 读取上传目录中的所有文件
      const fileNames = readdirSync(this.uploadDir);

      for (const fileName of fileNames) {
        // 跳过gzip文件
        if (fileName.endsWith('.gz')) continue;

        try {
          const filePath = join(this.uploadDir, fileName);
          const gzipPath = `${filePath}.gz`;
          const stats = statSync(filePath);
          let gzipStats = null;

          try {
            gzipStats = statSync(gzipPath);
          } catch {}

          const compressionRatio = gzipStats
            ? Math.round((1 - gzipStats.size / stats.size) * 100)
            : 0;

          // 直接使用文件名作为原始名称，因为我们保留了原始文件名
          const originalName = fileName;

          fileList.push({
            filename: fileName,
            originalName,
            size: stats.size,
            gzipSize: gzipStats?.size || 0,
            compressionRatio,
            uploadTime: stats.mtime.toISOString()
          });
        } catch (error) {
          this.logger.warn(`Error reading file ${fileName}:`, error as Error);
        }
      }

      // 按上传时间倒序排列
      fileList.sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime());

      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.writeHead(200);
      res.end(JSON.stringify({ files: fileList }));

    } catch (error) {
      this.logger.error('File list error:', error as Error);

      res.setHeader('Content-Type', 'application/json');
      res.writeHead(500);
      res.end(JSON.stringify({
        success: false,
        message: 'Failed to get file list',
        error: error instanceof Error ? error.message : 'Unknown error'
      }));
    }
  }
}