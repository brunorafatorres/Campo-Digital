import { Router } from 'express';

import { checkDatabaseConnection } from '../database/pool.js';

export const healthRouter = Router();

healthRouter.get('/', (_request, response) => {
  response.json({
    status: 'ok',
    service: 'campodigital-backend',
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
  });
});

healthRouter.get('/database', async (_request, response) => {
  try {
    const connected = await checkDatabaseConnection();

    if (!connected) {
      return response.status(503).json({
        status: 'error',
        database: 'unavailable',
      });
    }

    return response.json({
      status: 'ok',
      database: 'connected',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);

    return response.status(503).json({
      status: 'error',
      database: 'unavailable',
    });
  }
});
