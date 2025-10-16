const { GzipStaticServer } = require('./dist/server.js');

async function test() {
  const config = {
    port: 4001,
    host: '0.0.0.0',
    rootDir: './public',
    uploadDir: './uploads',
    gzip: true,
    gzipLevel: 6,
    gzipThreshold: 1024,
    cache: true,
    cacheMaxAge: 3600,
    watch: false,
    open: false,
    logLevel: 'info',
    cors: true,
    indexPath: 'index.html'
  };

  const server = new GzipStaticServer(config);

  try {
    await server.start();
    console.log('Test server started successfully');
    console.log('Upload API available at: http://localhost:4000/api/upload');
    console.log('Files API available at: http://localhost:4000/api/files');
    console.log('Web interface at: http://localhost:4000');

    // Keep server running
    process.on('SIGINT', async () => {
      console.log('Shutting down test server...');
      await server.stop();
      process.exit(0);
    });

  } catch (error) {
    console.error('Failed to start test server:', error);
    process.exit(1);
  }
}

test();