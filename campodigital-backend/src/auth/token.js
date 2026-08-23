import { createHmac, timingSafeEqual } from 'node:crypto';

function encode(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(content, secret) {
  return createHmac('sha256', secret).update(content).digest('base64url');
}

export function createAccessToken(user, { secret, ttlSeconds, now = Date.now() }) {
  const issuedAt = Math.floor(now / 1000);
  const header = encode({ alg: 'HS256', typ: 'JWT' });
  const payload = encode({
    sub: String(user.id),
    rol: user.rol,
    iat: issuedAt,
    exp: issuedAt + ttlSeconds,
  });
  const content = `${header}.${payload}`;

  return `${content}.${sign(content, secret)}`;
}

export function verifyAccessToken(token, { secret, now = Date.now() }) {
  const parts = token.split('.');

  if (parts.length !== 3) {
    throw new Error('Token inválido.');
  }

  const [header, payload, receivedSignature] = parts;
  const expectedSignature = sign(`${header}.${payload}`, secret);
  const receivedBuffer = Buffer.from(receivedSignature);
  const expectedBuffer = Buffer.from(expectedSignature);

  if (
    receivedBuffer.length !== expectedBuffer.length
    || !timingSafeEqual(receivedBuffer, expectedBuffer)
  ) {
    throw new Error('Token inválido.');
  }

  let claims;

  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
  } catch {
    throw new Error('Token inválido.');
  }

  if (!claims.sub || !claims.rol || !claims.exp || claims.exp <= Math.floor(now / 1000)) {
    throw new Error('Token vencido o inválido.');
  }

  return claims;
}
