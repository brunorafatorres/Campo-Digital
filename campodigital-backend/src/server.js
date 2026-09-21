import { createApp } from './app.js';
import { env } from './config/env.js';
import { closeDatabasePool } from './database/pool.js';

const app = createApp();

const server = app.listen(env.port, () => {
  console.log(`API CampoDigital disponível em http://localhost:${env.port}`);
});

async function shutdown(signal) {
  console.log(`${signal} recebido. Encerrando o servidor...`);

  server.close(async (error) => {
    if (error) {
      console.error('Não foi possível encerrar o servidor HTTP:', error);
      process.exitCode = 1;
      return;
    }

    try {
      await closeDatabasePool();
    } catch (databaseError) {
      console.error('Não foi possível encerrar o pool do banco de dados:', databaseError);
      process.exitCode = 1;
    }
  });
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));
