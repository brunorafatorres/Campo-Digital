import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'test_secret_with_at_least_32_characters';

const { createApp } = await import('../src/app.js');
const { createAccessToken } = await import('../src/auth/token.js');

const tokenOptions = { secret: process.env.AUTH_TOKEN_SECRET, ttlSeconds: 3600 };
const token = createAccessToken({ id: 7, rol: 'PRODUCTOR' }, tokenOptions);
const authorization = { authorization: `Bearer ${token}`, 'content-type': 'application/json' };

const activityService = {
  async list(userId) {
    assert.equal(userId, '7');
    return [{ id: 1, nombre: 'Gado de corte', descripcion: null, activa: true }];
  },
  async create(userId, input) {
    assert.equal(userId, '7');
    return { id: 2, ...input, activa: true };
  },
  async update(userId, id, input) {
    assert.equal(userId, '7');
    return { id, ...input };
  },
};

const categoryService = {
  async list(userId, tipo) {
    assert.equal(userId, '7');
    assert.equal(tipo, undefined);
    return [{ id: 1, nombre: 'Insumos', tipo: 'GASTO', origem: 'SISTEMA' }];
  },
  async create(userId, input) {
    assert.equal(userId, '7');
    return { id: 9, ...input, origem: 'PROPIA' };
  },
  async deactivate(userId, id) {
    assert.equal(userId, '7');
    assert.equal(id, 9);
  },
};

const authService = {
  async getUserById() {
    return { id: 7, nombre: 'Bruno', email: 'bruno@example.com', rol: 'PRODUCTOR' };
  },
};

let server;
let baseUrl;

before(async () => {
  const app = createApp({ authService, activityService, categoryService, tokenOptions });
  await new Promise((resolve) => { server = app.listen(0, '127.0.0.1', resolve); });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
});

test('las actividades requieren autenticación', async () => {
  const response = await fetch(`${baseUrl}/api/actividades`);
  assert.equal(response.status, 401);
});

test('lista las actividades del productor autenticado', async () => {
  const response = await fetch(`${baseUrl}/api/actividades`, { headers: authorization });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.actividades[0].nombre, 'Gado de corte');
});

test('crea una actividad para el productor autenticado', async () => {
  const response = await fetch(`${baseUrl}/api/actividades`, {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ nombre: 'Produção de leite', descripcion: 'Atividade principal' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.actividad.nombre, 'Produção de leite');
});

test('atualiza uma atividade do produtor autenticado', async () => {
  const response = await fetch(`${baseUrl}/api/actividades/2`, {
    method: 'PUT',
    headers: authorization,
    body: JSON.stringify({ nombre: 'Produção leiteira', descripcion: null, activa: false }),
  });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.actividad.id, 2);
  assert.equal(body.actividad.activa, false);
});

test('crea una categoría propia', async () => {
  const response = await fetch(`${baseUrl}/api/categorias`, {
    method: 'POST',
    headers: authorization,
    body: JSON.stringify({ nombre: 'Venda de leite', tipo: 'INGRESO' }),
  });
  const body = await response.json();
  assert.equal(response.status, 201);
  assert.equal(body.categoria.id, 9);
});

test('desactiva solamente una categoría propia', async () => {
  const response = await fetch(`${baseUrl}/api/categorias/9/desactivar`, {
    method: 'PATCH',
    headers: authorization,
  });
  assert.equal(response.status, 204);
});

test('sirve el frontend desde la raíz', async () => {
  const response = await fetch(`${baseUrl}/`);
  const html = await response.text();
  assert.equal(response.status, 200);
  assert.match(html, /CampoDigital/);
  assert.match(html, /Gestão rural sem complicação/);
  assert.match(html, /id="toggle-password"/);
  assert.match(html, /aria-label="Mostrar senha"/);
});
