import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';

process.env.DB_HOST = '127.0.0.1';
process.env.DB_NAME = 'campodigital_test';
process.env.DB_USER = 'campodigital_test';
process.env.DB_PASSWORD = 'test_only';
process.env.AUTH_TOKEN_SECRET = 'test_secret_with_at_least_32_characters';

const { createApp } = await import('../src/app.js');

let baseUrl;
let server;

before(async () => {
  const app = createApp();

  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', resolve);
  });

  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
});

test('GET /health informa que la API está activa', async () => {
  const response = await fetch(`${baseUrl}/health`);
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.status, 'ok');
  assert.equal(body.service, 'campodigital-backend');
  assert.equal(typeof body.timestamp, 'string');
});

test('una ruta desconocida responde con 404', async () => {
  const response = await fetch(`${baseUrl}/no-existe`);
  const body = await response.json();

  assert.equal(response.status, 404);
  assert.equal(body.status, 'error');
});
