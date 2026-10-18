import assert from 'node:assert/strict';
import { test } from 'node:test';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'test_secret_with_at_least_32_characters';

const { createApp } = await import('../src/app.js');
const { createAccessToken } = await import('../src/auth/token.js');

test('perfil: produtor edita seus dados sem alterar outra conta', async () => {
  const users = new Map([
    [7, { id: 7, nombre: 'Ana', email: 'ana@example.com', rol: 'PRODUCTOR', activo: true }],
    [8, { id: 8, nombre: 'Bruno', email: 'bruno@example.com', rol: 'PRODUCTOR', activo: true }],
  ]);
  const repository = {
    async findPublicById(id) { return users.get(Number(id)) ?? null; },
    async findByEmail(email) { return [...users.values()].find((user) => user.email === email) ?? null; },
    async updateProfile(id, data) {
      const user = users.get(Number(id));
      if (!user) return null;
      Object.assign(user, data);
      return user;
    },
  };
  const tokenOptions = { secret: process.env.AUTH_TOKEN_SECRET, ttlSeconds: 3600 };
  const app = createApp({ authRepository: repository, tokenOptions });
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/auth/me`;
  const token = createAccessToken(users.get(7), tokenOptions);
  const update = async (body, authorization = `Bearer ${token}`) => {
    const response = await fetch(baseUrl, {
      method: 'PUT',
      headers: { 'content-type': 'application/json', authorization },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };

  try {
    assert.equal((await update({ nombre: 'Nova', email: 'nova@example.com' }, '')).status, 401);
    assert.equal((await update({ nombre: 'A', email: 'nova@example.com' })).status, 400);
    assert.equal((await update({ nombre: 'Ana', email: 'bruno@example.com' })).status, 409);
    const saved = await update({ nombre: 'Ana Silva', email: ' ANA.NOVA@EXAMPLE.COM ' });
    assert.equal(saved.status, 200);
    assert.deepEqual(saved.body.usuario, {
      id: 7, nombre: 'Ana Silva', email: 'ana.nova@example.com', rol: 'PRODUCTOR',
      telefone: null, nome_propriedade: null, localidade: null,
    });
    assert.equal((await update({ nombre: 'Ana Silva', email: 'ana.nova@example.com', telefone: '123' })).status, 400);
    const rural = await update({
      nombre: 'Ana Silva', email: 'ana.nova@example.com', telefone: '+598 99 123 456',
      nome_propriedade: 'Sítio Esperança', localidade: 'Rivera',
    });
    assert.equal(rural.status, 200);
    assert.equal(rural.body.usuario.nome_propriedade, 'Sítio Esperança');
    assert.equal(rural.body.usuario.telefone, '+598 99 123 456');
    const legacy = await update({ nombre: 'Ana Rural', email: 'ana.nova@example.com' });
    assert.equal(legacy.body.usuario.localidade, 'Rivera');
    assert.equal(users.get(8).email, 'bruno@example.com');
    assert.equal((await (await fetch(baseUrl, { headers: { authorization: `Bearer ${token}` } })).json()).usuario.nombre, 'Ana Rural');
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
