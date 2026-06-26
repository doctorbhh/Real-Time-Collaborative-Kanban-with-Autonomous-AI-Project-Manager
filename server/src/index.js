require('dotenv').config();
const http = require('http');
const app = require('./app');
const { setupWebSocket } = require('./websocket');

const PORT = process.env.PORT || 3000;
const server = http.createServer(app);

const io = setupWebSocket(server);

app.set('io', io);

server.listen(PORT, async () => {
  console.log(`Kanban AI Server running on port ${PORT}`);
  console.log(`   Environment: ${process.env.NODE_ENV || 'development'}`);

  try {
    const { startScheduler } = require('./ai/scheduler');
    await startScheduler(io);
  } catch (err) {
    console.error('Failed to start AI scheduler:', err.message);
  }
});

process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});
