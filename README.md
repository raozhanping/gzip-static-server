# Gzip Static Server

一个轻量级的 Node.js 静态文件服务器，专为本地开发环境设计，支持 Gzip 压缩和热重载。

## 特性

- 🚀 **快速启动** - 零配置即可启动
- 🗜️ **Gzip 压缩** - 自动压缩文本文件，减少传输大小
- 💾 **内存缓存** - 智能缓存机制，提升响应速度
- 👀 **热重载** - 文件变化自动刷新
- 🌈 **彩色日志** - 友好的开发体验
- ⚙️ **灵活配置** - 支持配置文件和命令行参数
- 🔒 **安全防护** - 防止目录遍历攻击
- 📱 **CORS 支持** - 便于跨域开发

## 安装

### 全局安装
```bash
npm install -g gzip-static-server
```

### 本地安装
```bash
npm install --save-dev gzip-static-server
```

## 快速开始

### 基本用法
```bash
# 启动服务器，默认端口 3000，服务当前目录的 public 文件夹
gzip-server

# 指定端口和目录
gzip-server -p 8080 -d ./dist

# 开发模式（热重载）
gzip-server --watch --open
```

### 使用配置文件
```bash
# 创建配置文件
gzip-server create-config

# 使用配置文件启动
gzip-server -c gzip-server.config.json
```

## 命令行选项

```bash
Usage: gzip-server [options] [command]

Options:
  -p, --port <number>        端口号 (default: 3000)
  -h, --host <address>       主机地址 (default: 0.0.0.0)
  -d, --dir <path>           服务目录 (default: ./public)
  -c, --config <path>        配置文件路径
  --no-gzip                  禁用 Gzip 压缩
  --no-cache                 禁用缓存
  --watch                    启用文件监听和热重载
  --open                     自动打开浏览器
  --no-cors                  禁用 CORS
  --log-level <level>        日志级别 (debug, info, warn, error) (default: info)
  --gzip-level <number>      Gzip 压缩级别 1-9 (default: 6)
  --gzip-threshold <bytes>   最小压缩文件大小 (default: 1024)
```

## 配置文件

创建 `gzip-server.config.json` 文件：

```json
{
  "port": 3000,
  "host": "0.0.0.0",
  "rootDir": "./public",
  "gzip": true,
  "gzipLevel": 6,
  "gzipThreshold": 1024,
  "cache": true,
  "cacheMaxAge": 3600,
  "watch": false,
  "open": false,
  "logLevel": "info",
  "cors": false,
  "indexPath": "index.html"
}
```

### 配置说明

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `port` | number | 3000 | 服务器端口 |
| `host` | string | "0.0.0.0" | 绑定主机 |
| `rootDir` | string | "./public" | 静态文件目录 |
| `gzip` | boolean | true | 是否启用 Gzip 压缩 |
| `gzipLevel` | number | 6 | Gzip 压缩级别 (1-9) |
| `gzipThreshold` | number | 1024 | 最小压缩文件大小 (字节) |
| `cache` | boolean | true | 是否启用缓存 |
| `cacheMaxAge` | number | 3600 | 缓存最大时间 (秒) |
| `watch` | boolean | false | 是否监听文件变化 |
| `open` | boolean | false | 是否自动打开浏览器 |
| `logLevel` | string | "info" | 日志级别 |
| `cors` | boolean | false | 是否启用 CORS |
| `indexPath` | string | "index.html" | 默认首页文件 |

## 在项目中使用

### 作为 npm 脚本

在 `package.json` 中添加脚本：

```json
{
  "scripts": {
    "serve": "gzip-server -d ./dist -p 8080",
    "serve:dev": "gzip-server -d ./public --watch --open",
    "serve:prod": "gzip-server -d ./dist --no-cache"
  }
}
```

### 编程式使用

```javascript
import { GzipStaticServer } from 'gzip-static-server';

const config = {
  port: 3000,
  rootDir: './public',
  gzip: true,
  watch: true
};

const server = new GzipStaticServer(config);

await server.start();
```

## 性能优化

### Gzip 压缩
- 自动检测文件类型，只压缩文本文件
- 跳过已压缩的文件类型（图片、视频等）
- 默认只压缩大于 1KB 的文件
- 压缩结果缓存，避免重复压缩

### 缓存策略
- 内存缓存最近访问的文件
- ETag 和 Last-Modified 支持
- 智能缓存失效机制
- LRU 缓存淘汰策略

## 开发体验

### 热重载
```bash
gzip-server --watch
```
- 监听文件变化
- 自动清除缓存
- 支持浏览器自动刷新（可扩展）

### 日志输出
```bash
gzip-server --log-level debug
```
- 彩色日志输出
- 详细的请求信息
- 压缩统计信息
- 错误堆栈跟踪

## 安全特性

- 🔒 防止目录遍历攻击
- 🛡️ 安全 HTTP 头部设置
- 🚫 文件权限检查
- 🔍 路径验证和规范化

## 示例项目结构

```
my-project/
├── public/
│   ├── index.html
│   ├── css/
│   │   └── style.css
│   ├── js/
│   │   └── app.js
│   └── images/
│       └── logo.png
├── package.json
└── gzip-server.config.json
```

## 性能对比

使用 Gzip 压缩后的文件大小对比：

| 文件类型 | 原始大小 | 压缩后大小 | 压缩率 |
|----------|----------|------------|--------|
| HTML | 50KB | 15KB | 70% |
| CSS | 30KB | 8KB | 73% |
| JavaScript | 100KB | 35KB | 65% |
| JSON | 20KB | 6KB | 70% |

## 故障排除

### 常见问题

**Q: 端口被占用怎么办？**
A: 使用 `-p` 参数指定其他端口：
```bash
gzip-server -p 8080
```

**Q: 文件无法访问？**
A: 检查文件路径和权限：
```bash
gzip-server -d /path/to/files --log-level debug
```

**Q: 压缩不生效？**
A: 检查文件类型和大小：
```bash
gzip-server --log-level debug
```

### 调试模式

启用详细日志：
```bash
gzip-server --log-level debug
```

## 贡献

欢迎提交 Issue 和 Pull Request！

## 许可证

MIT License

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 Gzip 压缩
- 内存缓存
- 文件监听
- CLI 工具
- 配置文件支持