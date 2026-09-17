import { categoryKey } from './category-key.js';

const TYPES = new Set(['INGRESO', 'GASTO']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

export function createCategorySuggestionService(categoryService, client) {
  return {
    async suggest(userId, input = {}) {
      const descripcion = typeof input.descripcion === 'string' ? input.descripcion.trim() : '';
      const tipo = typeof input.tipo === 'string' ? input.tipo.trim().toUpperCase() : '';
      if (descripcion.length < 2 || descripcion.length > 255) {
        throw fail('A descrição deve ter entre 2 e 255 caracteres.');
      }
      if (!TYPES.has(tipo)) throw fail('Selecione Receita ou Despesa.');

      const categories = await categoryService.list(userId, tipo);
      const candidates = categories.filter((item) => item.activa !== false)
        .map((item) => ({ item, key: categoryKey(item.nombre, item.tipo) }))
        .filter((entry) => entry.key);
      if (!candidates.length) {
        throw fail('Não há categorias compatíveis disponíveis para a sugestão.', 422);
      }

      const prediction = await client.suggest({
        descripcion,
        tipo,
        categorias_disponiveis: [...new Set(candidates.map((entry) => entry.key))],
      });
      const match = candidates.find((entry) => entry.key === prediction.categoria_chave);
      if (!match) throw fail('A IA não encontrou uma categoria disponível. Selecione manualmente.', 422);

      const confidence = Number(prediction.confianca);
      return {
        categoria: match.item,
        confianca: Number.isFinite(confidence) ? Math.min(100, Math.max(0, confidence)) : 0,
        gerada_por_ia: true,
        aviso: 'Sugestão gerada por Inteligência Artificial. Você pode alterar a categoria antes de salvar.',
      };
    },
  };
}
