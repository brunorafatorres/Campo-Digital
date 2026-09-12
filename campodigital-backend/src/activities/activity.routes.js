import { Router } from 'express';

function readId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { status: 400 });
  }
  return id;
}

export function createActivityRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (request, response, next) => {
    try {
      response.json({ actividades: await service.list(request.auth.sub) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const actividad = await service.create(request.auth.sub, request.body);
      response.status(201).json({ actividad });
    } catch (error) {
      next(error);
    }
  });

  router.put('/:id', async (request, response, next) => {
    try {
      const actividad = await service.update(request.auth.sub, readId(request.params.id), request.body);
      response.json({ actividad });
    } catch (error) {
      next(error);
    }
  });

  return router;
}
