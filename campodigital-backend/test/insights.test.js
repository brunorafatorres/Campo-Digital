import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'test_secret_with_at_least_32_characters';

const { createApp } = await import('../src/app.js');
const { createInsightService } = await import('../src/insights/insight.service.js');
const { createAccessToken } = await import('../src/auth/token.js');

function fixture() {
  const movements = [
    { id: 1, user: '7', category: 1, categoryName: 'Venda de produção', type: 'INGRESO', description: 'Venda anterior', value: 1000, date: '2026-08-10' },
    { id: 2, user: '7', category: 2, categoryName: 'Combustível', type: 'GASTO', description: 'Diesel 1', value: 100, date: '2026-08-03' },
    { id: 3, user: '7', category: 2, categoryName: 'Combustível', type: 'GASTO', description: 'Diesel 2', value: 120, date: '2026-08-12' },
    { id: 4, user: '7', category: 2, categoryName: 'Combustível', type: 'GASTO', description: 'Diesel 3', value: 110, date: '2026-08-20' },
    { id: 5, user: '7', category: 1, categoryName: 'Venda de produção', type: 'INGRESO', description: 'Venda atual', value: 1500, date: '2026-09-10' },
    { id: 6, user: '7', category: 2, categoryName: 'Combustível', type: 'GASTO', description: 'Compra grande de diesel', value: 350, date: '2026-09-14' },
    { id: 7, user: '8', category: 2, categoryName: 'Combustível', type: 'GASTO', description: 'Outro produtor', value: 9999, date: '2026-09-14' },
  ];
  const saved = [];
  let preferences = { alertas_ativas: true, frequencia: 'SEMANAL', percentual_variacao: '20.00' };
  const select = (userId, start, end) => movements.filter((item) => item.user === String(userId)
    && item.date >= start && item.date <= end);
  const decimal = (value) => Number(value).toFixed(2);
  const repository = {
    async getPreferences() {
      return preferences;
    },
    async savePreferences(_userId, input) {
      preferences = { ...input, percentual_variacao: Number(input.percentual_variacao).toFixed(2) };
      return preferences;
    },
    async summarize(userId, start, end) {
      const rows = select(userId, start, end);
      const income = rows.filter((item) => item.type === 'INGRESO').reduce((sum, item) => sum + item.value, 0);
      const expense = rows.filter((item) => item.type === 'GASTO').reduce((sum, item) => sum + item.value, 0);
      return { quantidade: rows.length, receitas: decimal(income), despesas: decimal(expense), saldo: decimal(income - expense) };
    },
    async expenseCategories(userId, start, end) {
      const grouped = new Map();
      for (const item of select(userId, start, end).filter((row) => row.type === 'GASTO')) {
        const current = grouped.get(item.category) ?? { categoria_id: item.category,
          categoria: item.categoryName, quantidade: 0, total: 0 };
        current.quantidade++;
        current.total += item.value;
        grouped.set(item.category, current);
      }
      return [...grouped.values()].sort((a, b) => b.total - a.total)
        .map((item) => ({ ...item, total: decimal(item.total) }));
    },
    async periodMovements(userId, start, end) {
      return select(userId, start, end).map((item) => ({ id: item.id, categoria_id: item.category,
        categoria: item.categoryName, tipo: item.type, descripcion: item.description,
        valor: decimal(item.value), data: item.date }));
    },
    async historicalStats(userId, start, end) {
      const grouped = new Map();
      for (const item of select(userId, start, end)) {
        const key = `${item.category}:${item.type}`;
        const current = grouped.get(key) ?? { categoria_id: item.category, tipo: item.type, values: [] };
        current.values.push(item.value);
        grouped.set(key, current);
      }
      return [...grouped.values()].map(({ values, ...item }) => {
        const average = values.reduce((sum, value) => sum + value, 0) / values.length;
        const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / values.length;
        return { ...item, quantidade: values.length, media: decimal(average),
          desvio_padrao: decimal(Math.sqrt(variance)) };
      });
    },
    async create(userId, data) {
      const row = { id: saved.length + 1, ...data, tipo: 'RESUMEN', gerado_por_ia: true,
        foi_util: null, avaliado_em: null, criado_em: '2026-09-21T12:00:00Z',
        usuario_id: String(userId) };
      saved.unshift(row);
      return row;
    },
    async rate(userId, id, useful) {
      const row = saved.find((item) => item.id === id && item.usuario_id === String(userId));
      if (!row) return null;
      row.foi_util = useful;
      row.avaliado_em = '2026-09-21T13:00:00Z';
      return row;
    },
    async listByUser(userId) {
      return saved.filter((item) => item.usuario_id === String(userId));
    },
  };
  return { repository, saved };
}

test('insights: gera resumo, comparação e categoria de maior impacto', async () => {
  const service = createInsightService(fixture().repository);
  const insight = await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal(insight.dados_referencia.periodo_atual.receitas, '1500.00');
  assert.equal(insight.dados_referencia.periodo_atual.despesas, '350.00');
  assert.equal(insight.dados_referencia.periodo_atual.saldo, '1150.00');
  assert.equal(insight.dados_referencia.comparacoes.receitas.percentual, 50);
  assert.equal(insight.dados_referencia.categorias_despesas[0].categoria, 'Combustível');
  assert.equal(insight.dados_referencia.categorias_despesas[0].percentual, 100);
});

test('insights: identifica movimentação acima do padrão histórico', async () => {
  const service = createInsightService(fixture().repository);
  const insight = await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal(insight.dados_referencia.movimentacoes_atipicas.length, 1);
  assert.equal(insight.dados_referencia.movimentacoes_atipicas[0].descricao, 'Compra grande de diesel');
});

test('insights: gera alerta conforme percentual configurado pelo produtor', async () => {
  const data = fixture();
  const service = createInsightService(data.repository);
  await service.savePreferences('7', {
    alertas_ativas: true, frequencia: 'INMEDIATA', percentual_variacao: 5,
  });
  const insight = await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal(insight.dados_referencia.alertas_despesas.length, 1);
  assert.equal(insight.dados_referencia.alertas_despesas[0].categoria, 'Combustível');
  assert.equal(insight.dados_referencia.alertas_despesas[0].percentual_aumento, 6.06);
});

test('insights: respeita alertas desativados e valida as preferências', async () => {
  const data = fixture();
  const service = createInsightService(data.repository);
  await service.savePreferences('7', {
    alertas_ativas: false, frequencia: 'MENSUAL', percentual_variacao: 5,
  });
  const insight = await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.deepEqual(insight.dados_referencia.alertas_despesas, []);
  await assert.rejects(() => service.savePreferences('7', {
    alertas_ativas: true, frequencia: 'ANUAL', percentual_variacao: 20,
  }), /frequência/);
  await assert.rejects(() => service.savePreferences('7', {
    alertas_ativas: true, frequencia: 'SEMANAL', percentual_variacao: 101,
  }), /percentual mínimo/);
});

test('insights: produtor avalia somente a própria análise', async () => {
  const data = fixture();
  const service = createInsightService(data.repository);
  const insight = await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  assert.equal((await service.rate('7', insight.id, { util: true })).foi_util, true);
  await assert.rejects(() => service.rate('8', insight.id, { util: false }), /não encontrada/);
  await assert.rejects(() => service.rate('7', insight.id, { util: 'sim' }), /útil ou não/);
});

test('insights: salva e lista somente o histórico do produtor', async () => {
  const data = fixture();
  const service = createInsightService(data.repository);
  await service.analyze('7', { inicio: '2026-09-01', fim: '2026-09-30' });
  await service.analyze('8', { inicio: '2026-09-01', fim: '2026-09-30' });
  const history = await service.list('7');
  assert.equal(history.length, 1);
  assert.equal(history[0].usuario_id, '7');
});

test('insights: período vazio retorna orientação simples', async () => {
  const service = createInsightService(fixture().repository);
  const insight = await service.analyze('7', { inicio: '2025-01-01', fim: '2025-01-31' });
  assert.match(insight.mensagem, /Ainda não há lançamentos suficientes/);
});

test('insights: rejeita datas inválidas, invertidas ou período superior a um ano', async () => {
  const service = createInsightService(fixture().repository);
  await assert.rejects(() => service.analyze('7', null), /período da análise/);
  await assert.rejects(() => service.analyze('7', { inicio: '2026-02-30', fim: '2026-03-01' }), /data inicial válida/);
  await assert.rejects(() => service.analyze('7', { inicio: '2026-09-30', fim: '2026-09-01' }), /data inicial deve/);
  await assert.rejects(() => service.analyze('7', { inicio: '2025-01-01', fim: '2026-01-02' }), /366 dias/);
});

const tokenOptions = { secret: process.env.AUTH_TOKEN_SECRET, ttlSeconds: 3600 };
const insightService = {
  async list(userId) { return [{ id: 1, usuario_id: userId }]; },
  async analyze(userId, input) { return { id: 2, usuario_id: userId, ...input }; },
  async getPreferences() { return { alertas_ativas: true, frequencia: 'SEMANAL', percentual_variacao: '20.00' }; },
  async savePreferences(userId, input) { return { usuario_id: userId, ...input }; },
  async rate(userId, id, input) { return { id: Number(id), usuario_id: userId, foi_util: input.util }; },
};
let server;
let baseUrl;

before(async () => {
  const app = createApp({ insightService, tokenOptions });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('insights: rotas exigem autenticação', async () => {
  assert.equal((await fetch(`${baseUrl}/api/insights`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/insights/analisar`, { method: 'POST' })).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/insights/preferencias`)).status, 401);
  assert.equal((await fetch(`${baseUrl}/api/insights/1/avaliacao`, { method: 'PATCH' })).status, 401);
});

test('insights: produtor autenticado pode gerar e consultar análises', async () => {
  const token = createAccessToken({ id: 7, rol: 'PRODUCTOR' }, tokenOptions);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const created = await fetch(`${baseUrl}/api/insights/analisar`, { method: 'POST', headers,
    body: JSON.stringify({ inicio: '2026-09-01', fim: '2026-09-30' }) });
  assert.equal(created.status, 201);
  assert.equal((await created.json()).insight.usuario_id, '7');
  const listed = await fetch(`${baseUrl}/api/insights`, { headers });
  assert.equal(listed.status, 200);
  assert.equal((await listed.json()).insights[0].usuario_id, '7');
});

test('insights: produtor autenticado configura alertas e avalia análise', async () => {
  const token = createAccessToken({ id: 7, rol: 'PRODUCTOR' }, tokenOptions);
  const headers = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };
  const preferences = await fetch(`${baseUrl}/api/insights/preferencias`, { method: 'PUT', headers,
    body: JSON.stringify({ alertas_ativas: true, frequencia: 'DIARIA', percentual_variacao: 25 }) });
  assert.equal(preferences.status, 200);
  assert.equal((await preferences.json()).preferencias.usuario_id, '7');
  const rating = await fetch(`${baseUrl}/api/insights/2/avaliacao`, { method: 'PATCH', headers,
    body: JSON.stringify({ util: false }) });
  assert.equal(rating.status, 200);
  assert.equal((await rating.json()).insight.foi_util, false);
});
