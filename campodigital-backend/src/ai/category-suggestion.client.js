export function createCategorySuggestionClient({ baseUrl, timeoutMs, fetchImpl = fetch }) {
  return {
    async suggest(payload) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/suggest`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        if (!response.ok) throw new Error(`Serviço de IA respondeu ${response.status}.`);
        return await response.json();
      } catch (error) {
        throw Object.assign(new Error('Sugestão de IA indisponível. Selecione a categoria manualmente.'), {
          status: 503,
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }
    },

    async readInvoice(image, contentType) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const response = await fetchImpl(`${baseUrl}/read-invoice`, {
          method: 'POST',
          headers: { 'content-type': contentType },
          body: image,
          signal: controller.signal,
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          throw Object.assign(new Error(body.message ?? `Serviço de IA respondeu ${response.status}.`), {
            status: response.status === 400 ? 400 : 503,
          });
        }
        return await response.json();
      } catch (error) {
        if (error.status) throw error;
        throw Object.assign(new Error('Leitura de comprovante indisponível. Tente novamente ou preencha manualmente.'), {
          status: 503,
          cause: error,
        });
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
