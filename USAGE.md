# 使用指南

## 快速开始

### 1. 安装
```bash
npm install -g gzip-static-server
```

### 2. 基本使用
```bash
# 启动服务器（默认端口 3000，服务 public 目录）
gzip-server

# 自定义端口和目录
gzip-server -p 8080 -d ./dist

# 开发模式（热重载 + 自动打开浏览器）
gzip-server --watch --open
```

## 测试命令

### 测试当前服务器
```bash
# 测试主页
curl -I http://localhost:3001/

# 测试压缩效果
curl -H "Accept-Encoding: gzip" http://localhost:3001/ | wc -c

# 测试缓存
curl -H "If-None-Match: \"12733-1760531373183\"" -I http://localhost:3001/

# 下载文件
curl http://localhost:3001/test.txt
```

### 功能验证清单

- ✅ Gzip 压缩正常工作
- ✅ 压缩率达到 75%+
- ✅ ETag 缓存机制正常
- ✅ 文件监听功能正常
- ✅ 安全头部设置正确
- ✅ CORS 支持正常
- ✅ 彩色日志输出
- ✅ 配置系统工作正常

## 配置文件示例

创建 `gzip-server.config.json`：
```json
{
  "port": 3000,
  "rootDir": "./public",
  "gzip": true,
  "watch": true,
  "open": true,
  "logLevel": "info"
}
```

## 开发脚本

在 `package.json` 中添加：
```json
{
  "scripts": {
    "serve": "gzip-server -d ./dist",
    "serve:dev": "gzip-server -d ./public --watch --open",
    "serve:prod": "gzip-server -d ./dist --no-cache"
  }
}
```