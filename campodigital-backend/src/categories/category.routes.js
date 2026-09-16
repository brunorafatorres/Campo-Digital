import { Router } from 'express';

function readId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isSafeInteger(id) || id <= 0) {
    throw Object.assign(new Error('Identificador inválido.'), { status: 400 });
  }
  return id;
}

export function createCategoryRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (request, response, next) => {
    try {
      response.json({ categorias: await service.list(request.auth.sub, request.query.tipo, request.query.incluir_inativas) });
    } catch (error) {
      next(error);
    }
  });

  router.post('/', async (request, response, next) => {
    try {
      const categoria = await service.create(request.auth.sub, request.body);
      response.status(201).json({ categoria });
    } catch (error) {
      next(error);
    }
  });

  router.patch('/:id/desactivar', async (request, response, next) => {
    try {
      await service.deactivate(request.auth.sub, readId(request.params.id));
      response.status(204).end();
    } catch (error) {
      next(error);
    }
  });

  return router;
}
