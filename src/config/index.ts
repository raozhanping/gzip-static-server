import path from 'path';
import fs from 'fs';
import { ServerConfig } from '../types';

export const defaultConfig: ServerConfig = {
  port: 4000,
  host: '0.0.0.0',
  rootDir: './public',
  gzip: true,
  gzipLevel: 6,
  gzipThreshold: 1024,
  cache: true,
  cacheMaxAge: 3600,
  watch: false,
  open: false,
  logLevel: 'info',
  cors: false,
  indexPath: 'index.html'
};

export function loadConfig(configPath?: string): Partial<ServerConfig> {
  const configFiles = [
    configPath,
    './gzip-server.config.json',
    './.gzip-server.json',
    './package.json'
  ].filter(Boolean) as string[];

  for (const configFile of configFiles) {
    try {
      if (!fs.existsSync(configFile)) {
        continue;
      }

      const fileContent = fs.readFileSync(configFile, 'utf-8');
      const parsed = JSON.parse(fileContent);

      // 如果是 package.json，查找 gzipServer 字段
      if (configFile.endsWith('package.json')) {
        if (parsed.gzipServer) {
          return parsed.gzipServer;
        }
        continue;
      }

      return parsed;
    } catch (error) {
      console.warn(`Failed to load config from ${configFile}:`, error);
    }
  }

  return {};
}

export function mergeConfig(userConfig: Partial<ServerConfig>, cliConfig: Partial<ServerConfig>): ServerConfig {
  return {
    ...defaultConfig,
    ...userConfig,
    ...cliConfig
  };
}

export function validateConfig(config: ServerConfig): void {
  if (config.port < 1 || config.port > 65535) {
    throw new Error('Port must be between 1 and 65535');
  }

  if (!fs.existsSync(config.rootDir)) {
    throw new Error(`Root directory does not exist: ${config.rootDir}`);
  }

  if (config.gzipLevel < 1 || config.gzipLevel > 9) {
    throw new Error('Gzip level must be between 1 and 9');
  }

  if (config.gzipThreshold < 0) {
    throw new Error('Gzip threshold must be non-negative');
  }
}

export function resolveConfig(config: ServerConfig): ServerConfig {
  return {
    ...config,
    rootDir: path.resolve(config.rootDir)
  };
}