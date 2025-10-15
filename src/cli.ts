#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import path from 'path';
import fs from 'fs';
import { GzipStaticServer } from './server';
import { loadConfig, mergeConfig, validateConfig, resolveConfig } from './config';
import { ServerConfig } from './types';
import open from 'open';

const program = new Command();

program
  .name('gzip-server')
  .description('A lightweight Gzip-enabled static file server for local development')
  .version('1.0.0');

program
  .command('start', { isDefault: true })
  .description('Start the static file server')
  .option('-p, --port <number>', 'Port to listen on', '3000')
  .option('-h, --host <address>', 'Host to bind to', '0.0.0.0')
  .option('-d, --dir <path>', 'Directory to serve files from', './public')
  .option('-c, --config <path>', 'Path to config file')
  .option('--no-gzip', 'Disable gzip compression')
  .option('--no-cache', 'Disable caching')
  .option('--watch', 'Enable file watching and hot reload')
  .option('--open', 'Open browser automatically')
  .option('--no-cors', 'Disable CORS')
  .option('--log-level <level>', 'Log level (debug, info, warn, error)', 'info')
  .option('--gzip-level <number>', 'Gzip compression level (1-9)', '6')
  .option('--gzip-threshold <bytes>', 'Minimum file size to compress', '1024')
  .action(async (options) => {
    try {
      // 加载配置文件
      const fileConfig = loadConfig(options.config);

      // 构建 CLI 配置
      const cliConfig: Partial<ServerConfig> = {
        port: parseInt(options.port),
        host: options.host,
        rootDir: options.dir,
        gzip: options.gzip,
        gzipLevel: parseInt(options.gzipLevel),
        gzipThreshold: parseInt(options.gzipThreshold),
        cache: options.cache,
        watch: options.watch,
        open: options.open,
        cors: options.cors,
        logLevel: options.logLevel as 'debug' | 'info' | 'warn' | 'error'
      };

      // 合并配置
      const config = mergeConfig(fileConfig, cliConfig);

      // 验证配置
      validateConfig(config);

      // 解析配置中的路径
      const resolvedConfig = resolveConfig(config);

      // 创建并启动服务器
      const server = new GzipStaticServer(resolvedConfig);

      // 设置优雅关闭
      const gracefulShutdown = async (signal: string) => {
        console.log(chalk.yellow(`\nReceived ${signal}. Shutting down gracefully...`));
        await server.stop();
        process.exit(0);
      };

      process.on('SIGINT', () => gracefulShutdown('SIGINT'));
      process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

      // 启动服务器
      await server.start();

      // 自动打开浏览器
      if (resolvedConfig.open) {
        const url = `http://${resolvedConfig.host === '0.0.0.0' ? 'localhost' : resolvedConfig.host}:${resolvedConfig.port}`;
        setTimeout(() => {
          open(url).catch(() => {
            console.log(chalk.yellow(`Could not open browser. Please visit ${url} manually.`));
          });
        }, 1000);
      }

      // 启动后显示帮助信息
      if (resolvedConfig.watch) {
        console.log(chalk.cyan('\n📝 Development mode:'));
        console.log(chalk.gray('  • Watching for file changes...'));
        console.log(chalk.gray('  • Press Ctrl+C to stop'));
      }

    } catch (error) {
      console.error(chalk.red('Error starting server:'), error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program
  .command('create-config')
  .description('Create a sample configuration file')
  .option('-o, --output <path>', 'Output file path', './gzip-server.config.json')
  .action((options) => {
    const sampleConfig = {
      port: 3000,
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

    try {
      fs.writeFileSync(options.output, JSON.stringify(sampleConfig, null, 2));
      console.log(chalk.green(`✅ Configuration file created: ${options.output}`));
    } catch (error) {
      console.error(chalk.red('Error creating config file:'), error);
      process.exit(1);
    }
  });

program
  .command('version')
  .description('Show version information')
  .action(() => {
    console.log(chalk.cyan('Gzip Static Server v1.0.0'));
    console.log(chalk.gray('Node.js'), process.version);
    console.log(chalk.gray('Platform:'), process.platform);
  });

// 错误处理
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, 'reason:', reason);
  process.exit(1);
});

// 解析命令行参数
program.parse();

// 如果没有提供参数，显示帮助
if (!process.argv.slice(2).length) {
  program.outputHelp();
}