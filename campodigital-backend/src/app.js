import express from 'express';

import { createAuthRepository } from './auth/auth.repository.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { createAuthService } from './auth/auth.service.js';
import { createRequireAuth } from './auth/require-auth.js';
import { env } from './config/env.js';
import { pool } from './database/pool.js';
import { healthRouter } from './routes/health.routes.js';

export function createApp(overrides = {}) {
  const app = express();
  const tokenOptions = overrides.tokenOptions ?? {
    secret: env.auth.tokenSecret,
    ttlSeconds: env.auth.tokenTtlSeconds,
  };
  const authRepository = overrides.authRepository ?? createAuthRepository(pool);
  const authService = overrides.authService ?? createAuthService(authRepository, tokenOptions);
  const requireAuth = createRequireAuth(tokenOptions);

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/api/auth', createAuthRouter(authService, requireAuth));

  app.use((request, response) => {
    response.status(404).json({
      status: 'error',
      message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`,
    });
  });

  app.use((error, _request, response, _next) => {
    if (!error.status || error.status >= 500) {
      console.error(error);
    }

    response.status(error.status ?? 500).json({
      status: 'error',
      message: error.status ? error.message : 'Error interno del servidor.',
    });
  });

  return app;
}
