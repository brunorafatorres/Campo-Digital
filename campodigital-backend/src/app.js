import express from 'express';
import { fileURLToPath } from 'node:url';

import { createCategorySuggestionClient } from './ai/category-suggestion.client.js';
import { createCategorySuggestionRouter } from './ai/category-suggestion.routes.js';
import { createCategorySuggestionService } from './ai/category-suggestion.service.js';
import { createActivityRepository } from './activities/activity.repository.js';
import { createActivityRouter } from './activities/activity.routes.js';
import { createActivityService } from './activities/activity.service.js';
import { createAuthRepository } from './auth/auth.repository.js';
import { createAuthRouter } from './auth/auth.routes.js';
import { createAuthService } from './auth/auth.service.js';
import { createRequireAuth } from './auth/require-auth.js';
import { env } from './config/env.js';
import { createCategoryRepository } from './categories/category.repository.js';
import { createCategoryRouter } from './categories/category.routes.js';
import { createCategoryService } from './categories/category.service.js';
import { pool } from './database/pool.js';
import { createMovementRepository } from './movements/movement.repository.js';
import { createMovementService } from './movements/movement.service.js';
import { createMovementRouter } from './movements/movement.routes.js';
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
  const activityService = overrides.activityService
    ?? createActivityService(createActivityRepository(pool));
  const categoryService = overrides.categoryService
    ?? createCategoryService(createCategoryRepository(pool));
  const aiClient = overrides.aiClient ?? createCategorySuggestionClient(env.ai);
  const categorySuggestionService = overrides.categorySuggestionService
    ?? createCategorySuggestionService(categoryService, aiClient);
  const movementService = overrides.movementService
    ?? createMovementService(createMovementRepository(pool));

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRouter);
  app.use('/api/auth', createAuthRouter(authService, requireAuth));
  app.use('/api/actividades', createActivityRouter(activityService, requireAuth));
  app.use('/api/categorias', createCategoryRouter(categoryService, requireAuth));
  app.use('/api/ia', createCategorySuggestionRouter(categorySuggestionService, requireAuth));
  app.use('/api/movimientos', createMovementRouter(movementService, requireAuth));

  const publicDirectory = fileURLToPath(new URL('../public', import.meta.url));
  app.use(express.static(publicDirectory));

  app.use((request, response) => {
    response.status(404).json({
      status: 'error',
      message: `Ruta no encontrada: ${request.method} ${request.originalUrl}`,
    });
  });

  app.use((error, _request, response, _next) => {
    const outdatedSchema = ['ER_BAD_FIELD_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code);
    if (!error.status || error.status >= 500) {
      console.error(error);
    }

    response.status(outdatedSchema ? 503 : (error.status ?? 500)).json({
      status: 'error',
      message: outdatedSchema
        ? 'Banco de dados desatualizado. Execute npm run db:migrate e reinicie o servidor.'
        : (error.status ? error.message : 'Erro interno do servidor.'),
    });
  });

  return app;
}
