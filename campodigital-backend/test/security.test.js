import assert from 'node:assert/strict';
import { test } from 'node:test';

import { hashPassword, verifyPassword } from '../src/auth/password.js';
import { createAccessToken, verifyAccessToken } from '../src/auth/token.js';

test('a senha é armazenada como hash scrypt e pode ser verificada', async () => {
  const password = 'uma-senha-segura';
  const storedHash = await hashPassword(password);

  assert.match(storedHash, /^scrypt\$/);
  assert.notEqual(storedHash, password);
  assert.equal(await verifyPassword(password, storedHash), true);
  assert.equal(await verifyPassword('outra-senha', storedHash), false);
});

test('o token assinado preserva a identidade e rejeita alterações', () => {
  const options = { secret: 'test_secret_with_at_least_32_characters', ttlSeconds: 3600 };
  const token = createAccessToken({ id: 7, rol: 'PRODUCTOR' }, options);
  const claims = verifyAccessToken(token, options);

  assert.equal(claims.sub, '7');
  assert.equal(claims.rol, 'PRODUCTOR');
  assert.throws(() => verifyAccessToken(`${token}alterado`, options), /Token inválido/);
});
