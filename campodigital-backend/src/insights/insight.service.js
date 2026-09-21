const fail = (message, status = 400) => Object.assign(new Error(message), { status });
const DAY = 86_400_000;
const FREQUENCIES = new Set(['INMEDIATA', 'DIARIA', 'SEMANAL', 'MENSUAL']);

function readId(value) {
  if (!/^\d+$/.test(String(value)) || Number(value) < 1 || !Number.isSafeInteger(Number(value))) {
    throw fail('Insight inválido.');
  }
  return Number(value);
}

function readDate(value, label) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw fail(`Informe uma ${label} válida.`);
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw fail(`Informe uma ${label} válida.`);
  }
  return date;
}

function iso(date) {
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  return value.split('-').reverse().join('/');
}

function money(value) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
}

function variation(current, previous) {
  const atual = Number(current);
  const anterior = Number(previous);
  if (anterior === 0) return { percentual: null, direcao: atual === 0 ? 'ESTAVEL' : 'SEM_BASE' };
  const percentual = ((atual - anterior) / Math.abs(anterior)) * 100;
  return {
    percentual: Number(percentual.toFixed(2)),
    direcao: Math.abs(percentual) < 0.01 ? 'ESTAVEL' : (percentual > 0 ? 'AUMENTO' : 'REDUCAO'),
  };
}

function comparisonText(label, comparison) {
  if (comparison.direcao === 'SEM_BASE') return `${label}: não havia valor no período anterior.`;
  if (comparison.direcao === 'ESTAVEL') return `${label}: permaneceu estável em relação ao período anterior.`;
  const action = comparison.direcao === 'AUMENTO' ? 'aumentou' : 'reduziu';
  return `${label}: ${action} ${Math.abs(comparison.percentual).toFixed(1)}% em relação ao período anterior.`;
}

function anomalies(movements, stats) {
  const byKey = new Map(stats.map((item) => [`${item.categoria_id}:${item.tipo}`, item]));
  return movements.flatMap((item) => {
    const history = byKey.get(`${item.categoria_id}:${item.tipo}`);
    if (!history || Number(history.quantidade) < 3) return [];
    const media = Number(history.media);
    const desvio = Number(history.desvio_padrao);
    const limite = Math.max(media * 1.5, media + (2 * desvio));
    if (Number(item.valor) <= limite) return [];
    return [{
      id: item.id,
      descricao: item.descripcion,
      categoria: item.categoria,
      tipo: item.tipo,
      valor: item.valor,
      data: item.data,
      media_historica: media.toFixed(2),
      percentual_acima_media: media > 0
        ? Number((((Number(item.valor) - media) / media) * 100).toFixed(2)) : null,
    }];
  });
}

function expenseAlerts(currentCategories, previousCategories, preferences) {
  if (!preferences.alertas_ativas) return [];
  const threshold = Number(preferences.percentual_variacao);
  const previousByCategory = new Map(previousCategories.map((item) => [
    String(item.categoria_id), Number(item.total),
  ]));
  return currentCategories.flatMap((item) => {
    const previous = previousByCategory.get(String(item.categoria_id)) ?? 0;
    if (previous <= 0) return [];
    const current = Number(item.total);
    const percentage = ((current - previous) / previous) * 100;
    if (percentage < threshold) return [];
    return [{
      categoria_id: item.categoria_id,
      categoria: item.categoria,
      total_atual: current.toFixed(2),
      total_anterior: previous.toFixed(2),
      percentual_aumento: Number(percentage.toFixed(2)),
      percentual_configurado: threshold,
    }];
  });
}

export function createInsightService(repository) {
  return {
    async analyze(userId, input = {}) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw fail('Informe o período da análise.');
      }
      const start = readDate(input.inicio, 'data inicial');
      const end = readDate(input.fim, 'data final');
      if (start > end) throw fail('A data inicial deve ser anterior ou igual à data final.');
      const days = Math.round((end - start) / DAY) + 1;
      if (days > 366) throw fail('O período da análise não pode ultrapassar 366 dias.');

      const previousEnd = new Date(start.getTime() - DAY);
      const previousStart = new Date(previousEnd.getTime() - ((days - 1) * DAY));
      const historyStart = new Date(start);
      historyStart.setUTCFullYear(historyStart.getUTCFullYear() - 1);

      const [current, previous, categories, previousCategories, movements, stats, preferences] = await Promise.all([
        repository.summarize(userId, iso(start), iso(end)),
        repository.summarize(userId, iso(previousStart), iso(previousEnd)),
        repository.expenseCategories(userId, iso(start), iso(end)),
        repository.expenseCategories(userId, iso(previousStart), iso(previousEnd)),
        repository.periodMovements(userId, iso(start), iso(end)),
        repository.historicalStats(userId, iso(historyStart), iso(previousEnd)),
        repository.getPreferences(userId),
      ]);

      const comparisons = {
        receitas: variation(current.receitas, previous.receitas),
        despesas: variation(current.despesas, previous.despesas),
        saldo: variation(current.saldo, previous.saldo),
      };
      const totalExpenses = Number(current.despesas);
      const categoryImpact = categories.map((item) => ({
        categoria_id: item.categoria_id,
        categoria: item.categoria,
        quantidade: Number(item.quantidade),
        total: item.total,
        percentual: totalExpenses > 0
          ? Number(((Number(item.total) / totalExpenses) * 100).toFixed(2)) : 0,
      }));
      const unusual = anomalies(movements, stats);
      const alerts = expenseAlerts(categories, previousCategories, preferences);
      const messages = [
        `No período de ${formatDate(input.inicio)} a ${formatDate(input.fim)}, foram registradas ${money(current.receitas)} em receitas, ${money(current.despesas)} em despesas e saldo de ${money(current.saldo)}.`,
        comparisonText('Receitas', comparisons.receitas),
        comparisonText('Despesas', comparisons.despesas),
      ];
      if (categoryImpact[0]) {
        messages.push(`${categoryImpact[0].categoria} foi a categoria com maior impacto nas despesas, representando ${categoryImpact[0].percentual.toFixed(1)}% do total.`);
      }
      if (unusual.length) messages.push(`Foram identificadas ${unusual.length} movimentação(ões) acima do padrão histórico.`);
      if (alerts.length) messages.push(`${alerts.length} categoria(s) ultrapassaram o percentual de aumento configurado para alertas.`);
      if (!Number(current.quantidade)) messages.push('Ainda não há lançamentos suficientes neste período para uma análise detalhada.');

      return repository.create(userId, {
        periodo_inicio: input.inicio,
        periodo_fim: input.fim,
        titulo: `Análise financeira de ${formatDate(input.inicio)} a ${formatDate(input.fim)}`,
        mensagem: messages.join(' '),
        dados_referencia: {
          periodo_atual: { inicio: input.inicio, fim: input.fim, ...current },
          periodo_anterior: { inicio: iso(previousStart), fim: iso(previousEnd), ...previous },
          comparacoes: comparisons,
          categorias_despesas: categoryImpact,
          movimentacoes_atipicas: unusual,
          alertas_despesas: alerts,
          preferencias_alertas: preferences,
          aviso: 'Análise automática para apoio à organização financeira. Não substitui orientação contábil.',
        },
      });
    },

    list(userId) {
      return repository.listByUser(userId);
    },

    getPreferences(userId) {
      return repository.getPreferences(userId);
    },

    async savePreferences(userId, input = {}) {
      if (!input || typeof input !== 'object' || Array.isArray(input)) {
        throw fail('Informe as preferências de alertas.');
      }
      if (typeof input.alertas_ativas !== 'boolean') {
        throw fail('Informe se os alertas devem permanecer ativos.');
      }
      if (!FREQUENCIES.has(input.frequencia)) {
        throw fail('Selecione uma frequência de alertas válida.');
      }
      const percentage = Number(input.percentual_variacao);
      if (!Number.isFinite(percentage) || percentage <= 0 || percentage > 100) {
        throw fail('O percentual mínimo deve estar entre 0,01 e 100.');
      }
      return repository.savePreferences(userId, {
        alertas_ativas: input.alertas_ativas,
        frequencia: input.frequencia,
        percentual_variacao: Number(percentage.toFixed(2)),
      });
    },

    async rate(userId, id, input = {}) {
      if (!input || typeof input !== 'object' || Array.isArray(input)
        || typeof input.util !== 'boolean') {
        throw fail('Informe se a análise foi útil ou não.');
      }
      const insight = await repository.rate(userId, readId(id), input.util);
      if (!insight) throw fail('Análise não encontrada.', 404);
      return insight;
    },
  };
}
