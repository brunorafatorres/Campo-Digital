import { Router } from 'express';

export function createCategorySuggestionRouter(service, requireAuth) {
  const router = Router();
  router.use(requireAuth);
  router.post('/sugerir-categoria', async (request, response) => {
    response.json(await service.suggest(request.auth.sub, request.body));
  });
  return router;
}
