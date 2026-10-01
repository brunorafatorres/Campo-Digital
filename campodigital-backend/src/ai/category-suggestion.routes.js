import express, { Router } from 'express';

export function createCategorySuggestionRouter(service, requireAuth, invoiceAnalysisService = null) {
  const router = Router();
  router.use(requireAuth);
  router.post('/sugerir-categoria', async (request, response) => {
    response.json(await service.suggest(request.auth.sub, request.body));
  });
  if (invoiceAnalysisService) {
    router.post('/analisar-comprovante', express.raw({
      type: ['image/jpeg', 'image/png', 'image/webp'],
      limit: '5mb',
    }), async (request, response) => {
      response.json(await invoiceAnalysisService.analyze(
        request.auth.sub,
        request.body,
        request.get('content-type')?.split(';')[0].trim().toLowerCase(),
      ));
    });
  }
  return router;
}
