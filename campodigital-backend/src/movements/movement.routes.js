import { Router } from 'express';

export function createMovementRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (request, response) => {
    response.json(await service.list(request.auth.sub, request.query));
  });

  router.get('/resumen', async (request, response) => {
    response.json({ resumen: await service.summarize(request.auth.sub, request.query) });
  });

  router.post('/', async (request, response) => {
    response.status(201).json({ movimiento: await service.create(request.auth.sub, request.body) });
  });

  router.put('/:id', async (request, response) => {
    response.json({ movimiento: await service.update(request.auth.sub, request.params.id, request.body) });
  });

  router.delete('/:id', async (request, response) => {
    await service.remove(request.auth.sub, request.params.id);
    response.status(204).end();
  });

  return router;
}
