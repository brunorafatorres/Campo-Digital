import express from 'express';

import { healthRouter } from './routes/health.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);

  app.use((request, response) => {
    response.status(404).json({
      status: 'error',
      message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`,
    });
  });

  app.use((error, _request, response, _next) => {
    console.error(error);

    response.status(error.status ?? 500).json({
      status: 'error',
      message: error.status ? error.message : 'Error interno del servidor.',
    });
  });

  return app;
}
