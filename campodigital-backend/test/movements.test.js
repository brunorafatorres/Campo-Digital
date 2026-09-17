import assert from 'node:assert/strict';
import { before, after, beforeEach, test } from 'node:test';
import { createMovementFixture } from '../test-support/movement-fixture.js';
import { createMovementService } from '../src/movements/movement.service.js';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'isolated_test_secret_at_least_32_characters';
const { createApp } = await import('../src/app.js');
const { createAccessToken } = await import('../src/auth/token.js');
const options = { secret: process.env.AUTH_TOKEN_SECRET, ttlSeconds: 3600 };
const authorization = `Bearer ${createAccessToken({ id: 7, rol: 'PRODUCTOR' }, options)}`;
let fixture; let server; let base;
const input = { tipo: 'INGRESO', categoria_id: 1, descripcion: 'Venda de leite', valor: '150.50', fecha: '2026-09-12' };

before(async () => {
  // Fresh service and repository for each test, with real Express routes and token validation.
  const service = new Proxy({}, { get: (_, method) => (...args) => createMovementService(fixture.repository)[method](...args) });
  server = createApp({ movementService: service, tokenOptions: options }).listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${server.address().port}/api/movimientos`;
});
beforeEach(() => { fixture = createMovementFixture(); });
after(async () => { await new Promise((resolve) => server.close(resolve)); });

async function request(path = '', method = 'GET', body) {
  const response = await fetch(base + path, { method,
    headers: { authorization, 'content-type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  return { status: response.status, body: response.status === 204 ? null : await response.json() };
}
const create = (changes = {}) => request('', 'POST', { ...input, ...changes });

test('movimentações: todas as operações exigem autenticação', async () => {
  for (const [path, method] of [['', 'GET'], ['/resumen', 'GET'], ['/graficos', 'GET'], ['', 'POST'], ['/1', 'PUT'], ['/1', 'DELETE']]) {
    assert.equal((await fetch(base + path, { method })).status, 401);
  }
  assert.equal(fixture.rows.length, 0);
});

test('gráficos: agrupa valores por categoria e por mês', async () => {
  await create({ fecha: '2026-08-20', valor: '100.00' });
  await create({ fecha: '2026-09-10', valor: '250.50' });
  await create({ fecha: '2026-09-11', tipo: 'GASTO', categoria_id: 2, valor: '80.25' });
  const result = await request('/graficos');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.categorias, [
    { categoria_id: 1, categoria: 'Venda de produção', tipo: 'INGRESO', cantidad: 2, total: '350.50' },
    { categoria_id: 2, categoria: 'Ração', tipo: 'GASTO', cantidad: 1, total: '80.25' },
  ]);
  assert.deepEqual(result.body.periodos, [
    { periodo: '2026-08', total_ingresos: '100.00', total_gastos: '0.00', saldo: '100.00' },
    { periodo: '2026-09', total_ingresos: '250.50', total_gastos: '80.25', saldo: '170.25' },
  ]);
});

test('gráficos: respeita período, tipo, categoria e isolamento do produtor', async () => {
  await create({ fecha: '2026-09-10', valor: '40.00' });
  await create({ fecha: '2026-09-11', tipo: 'GASTO', categoria_id: 2, valor: '15.00' });
  await create({ fecha: '2026-10-01', tipo: 'GASTO', categoria_id: 2, valor: '20.00' });
  await fixture.repository.create('8', { ...input, valor: '999.00' });
  const result = await request('/graficos?desde=2026-09-01&hasta=2026-09-30&tipo=GASTO&categoria_id=2');
  assert.deepEqual(result.body.categorias, [
    { categoria_id: 2, categoria: 'Ração', tipo: 'GASTO', cantidad: 1, total: '15.00' },
  ]);
  assert.deepEqual(result.body.periodos, [
    { periodo: '2026-09', total_ingresos: '0.00', total_gastos: '15.00', saldo: '-15.00' },
  ]);
});

test('movimentações: cadastro usa o produtor do token e preserva centavos', async () => {
  const result = await create({ usuario_id: 8, valor: '000150,50' });
  assert.equal(result.status, 201);
  assert.equal(result.body.movimiento.valor, '150.50');
  assert.equal(fixture.rows[0].usuario_id, '7');
  assert.equal(result.body.movimiento.fecha, '2026-09-12');
});

test('movimentações: registra sugestão da IA e permite que o produtor altere a categoria final', async () => {
  const result = await create({ tipo: 'GASTO', categoria_id: 2,
    categoria_sugerida_id: 3, confianza_ia: 78.456 });
  assert.equal(result.status, 400, 'categoria sugerida inativa deve ser rejeitada');

  const accepted = await create({ categoria_sugerida_id: 1, confianza_ia: '91.25' });
  assert.equal(accepted.status, 201);
  assert.equal(accepted.body.movimiento.categoria_sugerida_id, 1);
  assert.equal(accepted.body.movimiento.confianza_ia, '91.25');
});

test('movimentações: rejeita metadados incompletos ou inválidos da IA', async () => {
  for (const changes of [
    { categoria_sugerida_id: 1 }, { confianza_ia: 50 },
    { categoria_sugerida_id: 1, confianza_ia: -1 },
    { categoria_sugerida_id: 1, confianza_ia: 101 },
    { categoria_sugerida_id: 2, confianza_ia: 80 },
  ]) assert.equal((await create(changes)).status, 400);
});

test('movimentações: registra despesa com categoria própria', async () => {
  const result = await create({ tipo: 'GASTO', categoria_id: 2, valor: '0.01' });
  assert.equal(result.status, 201);
  assert.equal(result.body.movimiento.categoria, 'Ração');
  assert.equal((await request('/resumen')).body.resumen.saldo, '-0.01');
});

test('movimentações: rejeita valores negativos, zero, imprecisos ou fora do limite', async () => {
  for (const valor of ['0', '-1', '1.234', '1e3', 'abc', '1.000,00', '1000000000000', null, true, {}, []]) {
    assert.equal((await create({ valor })).status, 400, JSON.stringify(valor));
  }
  assert.equal(fixture.rows.length, 0);
  assert.equal((await create({ valor: '999999999999.99' })).status, 201);
});

test('movimentações: valida datas reais, inclusive anos bissextos', async () => {
  for (const fecha of ['2026-02-29', '2026-02-31', '2026-04-31', '2026-13-01', '12/09/2026', '', null, '0000-01-01']) {
    assert.equal((await create({ fecha })).status, 400, String(fecha));
  }
  assert.equal((await create({ fecha: '2024-02-29' })).status, 201);
});

test('movimentações: exige descrição, tipo e categoria válidos', async () => {
  for (const change of [{ descripcion: ' ' }, { descripcion: 'x'.repeat(256) }, { tipo: 'OUTRO' },
    { categoria_id: '1abc' }, { categoria_id: 0 }, { categoria_id: '9007199254740992' }]) {
    assert.equal((await create(change)).status, 400);
  }
  assert.equal((await request('', 'POST', [])).status, 400);
});

test('movimentações: rejeita categoria alheia, inativa, inexistente ou de outro tipo', async () => {
  for (const change of [{ categoria_id: 4, tipo: 'GASTO' }, { categoria_id: 3, tipo: 'GASTO' },
    { categoria_id: 99 }, { categoria_id: 2 }]) {
    assert.equal((await create(change)).status, 400);
  }
  assert.equal(fixture.rows.length, 0);
});

test('movimentações: edição e exclusão recalculam os totais', async () => {
  const { body } = await create();
  const path = `/${body.movimiento.id}`;
  assert.equal((await request(path, 'PUT', { ...input, tipo: 'GASTO', categoria_id: 2, valor: '30.20' })).status, 200);
  assert.deepEqual((await request('/resumen')).body.resumen,
    { cantidad: 1, total_ingresos: '0.00', total_gastos: '30.20', saldo: '-30.20' });
  assert.equal((await request(path, 'DELETE')).status, 204);
  assert.equal((await request('/resumen')).body.resumen.cantidad, 0);
  assert.equal((await request(path, 'DELETE')).status, 404);
});

test('movimentações: editar sem alterar valores também funciona', async () => {
  const { body } = await create();
  assert.equal((await request(`/${body.movimiento.id}`, 'PUT', input)).status, 200);
});

test('movimentações: outro produtor não aparece nas consultas nem pode ser alterado', async () => {
  const other = await fixture.repository.create('8', { ...input });
  assert.equal((await request()).body.movimientos.length, 0);
  assert.equal((await request('/resumen')).body.resumen.cantidad, 0);
  assert.equal((await request(`/${other.id}`, 'PUT', input)).status, 404);
  assert.equal((await request(`/${other.id}`, 'DELETE')).status, 404);
  assert.equal(fixture.rows.length, 1);
});

test('movimentações: preserva categoria arquivada apenas no lançamento original', async () => {
  const { body } = await create({ tipo: 'GASTO', categoria_id: 2 });
  fixture.categories.find((item) => item.id === 2).activa = false;
  assert.equal((await request(`/${body.movimiento.id}`, 'PUT', { ...input, tipo: 'GASTO', categoria_id: 2, valor: '42.00' })).status, 200);
  assert.equal((await create({ tipo: 'GASTO', categoria_id: 2 })).status, 400);
  assert.equal((await request(`/${body.movimiento.id}`, 'PUT', { ...input, tipo: 'GASTO', categoria_id: 3 })).status, 400);
});

test('movimentações: filtros de período incluem os limites e combinam tipo e categoria', async () => {
  for (const fecha of ['2026-08-31', '2026-09-01', '2026-09-30', '2026-10-01']) await create({ fecha });
  await create({ tipo: 'GASTO', categoria_id: 2 });
  const result = await request('?desde=2026-09-01&hasta=2026-09-30&tipo=INGRESO&categoria_id=1');
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.movimientos.map((item) => item.fecha), ['2026-09-30', '2026-09-01']);
  assert.equal(result.body.resumen.saldo, '301.00');
  assert.equal((await request('/resumen?desde=2026-09-01&hasta=2026-09-30&tipo=GASTO')).body.resumen.total_gastos, '150.50');
});

test('movimentações: paginação não limita os totais e mantém ordenação estável', async () => {
  for (let i = 0; i < 22; i++) await create({ valor: '0.10' });
  const first = (await request()).body;
  const second = (await request('?pagina=2')).body;
  assert.equal(first.movimientos.length, 20);
  assert.equal(second.movimientos.length, 2);
  assert.equal(first.resumen.saldo, '2.20');
  assert.deepEqual(first.resumen, second.resumen);
  assert.equal(first.paginacion.total_paginas, 2);
  assert.ok(first.movimientos.at(-1).id > second.movimientos[0].id);
});

test('movimentações: consultas vazias retornam totais zerados', async () => {
  const result = (await request()).body;
  assert.deepEqual(result.movimientos, []);
  assert.deepEqual(result.resumen, { cantidad: 0, total_ingresos: '0.00', total_gastos: '0.00', saldo: '0.00' });
  assert.equal(result.paginacion.total_paginas, 1);
});

test('movimentações: rejeita filtros invertidos, repetidos e IDs malformados', async () => {
  for (const query of ['?desde=2026-09-30&hasta=2026-09-01', '?desde=2026-02-31', '?tipo=OUTRO',
    '?tipo=INGRESO&tipo=GASTO', '?categoria_id=1junk', '?pagina=0', '?pagina=1.5', '?pagina=1000001']) {
    assert.equal((await request(query)).status, 400, query);
  }
  assert.equal((await request('/1junk', 'DELETE')).status, 400);
  assert.equal((await request('/-1', 'PUT', input)).status, 400);
});
