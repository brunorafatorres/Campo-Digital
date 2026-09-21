import { Router } from 'express';

export function createInsightRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (request, response) => {
    response.json({ insights: await service.list(request.auth.sub) });
  });

  router.get('/preferencias', async (request, response) => {
    response.json({ preferencias: await service.getPreferences(request.auth.sub) });
  });

  router.put('/preferencias', async (request, response) => {
    response.json({ preferencias: await service.savePreferences(request.auth.sub, request.body) });
  });

  router.post('/analisar', async (request, response) => {
    response.status(201).json({ insight: await service.analyze(request.auth.sub, request.body) });
  });

  router.patch('/:id/avaliacao', async (request, response) => {
    response.json({ insight: await service.rate(request.auth.sub, request.params.id, request.body) });
  });

  return router;
}
