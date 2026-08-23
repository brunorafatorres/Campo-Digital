import { Router } from 'express';

export function createAuthRouter(authService, requireAuth) {
  const router = Router();

  router.post('/register', async (request, response, next) => {
    try {
      const session = await authService.register(request.body);
      response.status(201).json(session);
    } catch (error) {
      next(error);
    }
  });

  router.post('/login', async (request, response, next) => {
    try {
      const session = await authService.login(request.body);
      response.json(session);
    } catch (error) {
      next(error);
    }
  });

  router.get('/me', requireAuth, async (request, response, next) => {
    try {
      const user = await authService.getUserById(request.auth.sub);
      response.json({ usuario: user });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
