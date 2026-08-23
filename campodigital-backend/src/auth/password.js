import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

export async function hashPassword(password) {
  const salt = randomBytes(16);
  const derivedKey = await scrypt(password, salt, KEY_LENGTH);

  return `scrypt$${salt.toString('base64url')}$${derivedKey.toString('base64url')}`;
}

export async function verifyPassword(password, storedHash) {
  const [algorithm, saltValue, keyValue] = storedHash.split('$');

  if (algorithm !== 'scrypt' || !saltValue || !keyValue) {
    return false;
  }

  const expectedKey = Buffer.from(keyValue, 'base64url');
  const actualKey = await scrypt(
    password,
    Buffer.from(saltValue, 'base64url'),
    expectedKey.length,
  );

  return actualKey.length === expectedKey.length && timingSafeEqual(actualKey, expectedKey);
}
