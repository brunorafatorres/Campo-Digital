import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePool } from './database/pool.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`CampoDigital API listening on http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} received. Closing server...`);

  server.close(async (error) => {
    if (error) {
      console.error('Failed to close HTTP server:', error);
      process.exitCode = 1;
      return;
    }

    try {
      await closeDatabasePool();
    } catch (databaseError) {
      console.error('Failed to close database pool:', databaseError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
