import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'test_secret_with_at_least_32_characters';

const { createApp } = await import('../src/app.js');

const tokenOptions = {
  secret: process.env.AUTH_TOKEN_SECRET,
  ttlSeconds: 3600,
};

const fakeUser = {
  id: 7,
  nombre: 'Bruno',
  email: 'bruno@example.com',
  rol: 'PRODUCTOR',
};

const authService = {
  async register(input) {
    assert.equal(input.email, 'bruno@example.com');
    return { usuario: fakeUser, accessToken: 'registered-token', expiresIn: 3600 };
  },
  async login(input) {
    if (input.password !== 'correct-password') {
      throw Object.assign(new Error('Credenciales inválidas.'), { status: 401 });
    }
    return { usuario: fakeUser, accessToken: 'login-token', expiresIn: 3600 };
  },
  async getUserById(id) {
    assert.equal(id, '7');
    return fakeUser;
  },
};

let baseUrl;
let server;

before(async () => {
  const app = createApp({ authService, tokenOptions });
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('POST /api/auth/register crea una sesión', async () => {
  const response = await fetch(`${baseUrl}/api/auth/register`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: fakeUser.email }),
  });
  const body = await response.json();

  assert.equal(response.status, 201);
  assert.equal(body.usuario.id, 7);
  assert.equal(body.accessToken, 'registered-token');
});

test('POST /api/auth/login rechaza credenciales incorrectas', async () => {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: fakeUser.email, password: 'incorrecta' }),
  });
  const body = await response.json();

  assert.equal(response.status, 401);
  assert.equal(body.message, 'Credenciales inválidas.');
});

test('GET /api/auth/me exige y valida un token', async () => {
  const { createAccessToken } = await import('../src/auth/token.js');
  const token = createAccessToken(fakeUser, tokenOptions);
  const response = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.usuario.email, fakeUser.email);
});
