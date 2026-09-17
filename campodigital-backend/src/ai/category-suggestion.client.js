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
  };
}
