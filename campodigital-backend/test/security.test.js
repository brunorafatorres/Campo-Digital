import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { createAccessToken, verifyAccessToken } from '../src/auth/token.js';

test('la contraseña se almacena como hash scrypt y puede verificarse', async () => {
  const password = 'una-clave-segura';
  const storedHash = await hashPassword(password);

  assert.match(storedHash, /^scrypt\$/);
  assert.notEqual(storedHash, password);
  assert.equal(await verifyPassword(password, storedHash), true);
  assert.equal(await verifyPassword('otra-clave', storedHash), false);
});

test('el token firmado conserva la identidad y rechaza alteraciones', () => {
  const options = { secret: 'test_secret_with_at_least_32_characters', ttlSeconds: 3600 };
  const token = createAccessToken({ id: 7, rol: 'PRODUCTOR' }, options);
  const claims = verifyAccessToken(token, options);

  assert.equal(claims.sub, '7');
  assert.equal(claims.rol, 'PRODUCTOR');
  assert.throws(() => verifyAccessToken(`${token}alterado`, options), /Token inválido/);
});
