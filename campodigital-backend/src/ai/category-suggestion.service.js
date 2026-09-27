import { categoryKey } from './category-key.js';

const TYPES = new Set(['INGRESO', 'GASTO']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const IGNORED_WORDS = new Set(['a', 'as', 'com', 'compra', 'da', 'das', 'de', 'despesa',
  'do', 'dos', 'e', 'em', 'gasto', 'o', 'os', 'pagamento', 'para', 'por', 'receita', 'um',
  'uma', 'valor']);

function normalize(value) {
  return String(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function tokens(value) {
  return new Set(normalize(value).split(' ')
    .filter((word) => word.length >= 3 && !IGNORED_WORDS.has(word)));
}

function similarity(left, right) {
  const normalizedLeft = normalize(left);
  const normalizedRight = normalize(right);
  if (!normalizedLeft || !normalizedRight) return 0;
  if (normalizedLeft === normalizedRight) return 1;
  const leftTokens = tokens(left);
  const rightTokens = tokens(right);
  if (!leftTokens.size || !rightTokens.size) return 0;
  const intersection = [...leftTokens].filter((word) => rightTokens.has(word)).length;
  if (!intersection) return 0;
  return intersection / Math.min(leftTokens.size, rightTokens.size);
}

function learnedMatch(description, corrections, candidates) {
  const visible = new Map(candidates.map((entry) => [String(entry.item.id), entry.item]));
  return corrections.map((correction) => ({
    correction,
    category: visible.get(String(correction.categoria_id)),
    score: similarity(description, correction.descripcion),
  })).filter((entry) => entry.category && entry.score >= 0.5)
    .sort((left, right) => right.score - left.score)[0] ?? null;
}

export function createCategorySuggestionService(categoryService, client, correctionRepository = null) {
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

      if (correctionRepository) {
        const corrections = await correctionRepository.listCorrections(userId, tipo);
        const learned = learnedMatch(descripcion, corrections, candidates);
        if (learned) {
          return {
            categoria: learned.category,
            confianca: Number(Math.min(99, Math.max(70, learned.score * 100)).toFixed(2)),
            gerada_por_ia: true,
            aprendeu_com_correcao: true,
            aviso: 'Sugestão personalizada com base em uma correção anterior. Você pode alterá-la antes de salvar.',
          };
        }
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
        aprendeu_com_correcao: false,
        aviso: 'Sugestão gerada por Inteligência Artificial. Você pode alterar a categoria antes de salvar.',
      };
    },
  };
}
