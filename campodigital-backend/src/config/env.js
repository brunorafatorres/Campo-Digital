import 'dotenv/config';

function readInteger(name, fallback) {
  const rawValue = process.env[name];

  if (rawValue === undefined || rawValue === '') {
    return fallback;
  }

  const value = Number.parseInt(rawValue, 10);

  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${name} debe ser un número entero positivo.`);
  }

  return value;
}

function readRequired(name) {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Falta la variable de entorno obligatoria ${name}.`);
  }

  return value;
}

function readOptional(name, fallback) {
  return process.env[name]?.trim() || fallback;
}

export const env = Object.freeze({
  nodeEnv: process.env.NODE_ENV?.trim() || 'development',
  port: readInteger('PORT', 3000),
  database: Object.freeze({
    host: readRequired('DB_HOST'),
    port: readInteger('DB_PORT', 3306),
    name: readRequired('DB_NAME'),
    user: readRequired('DB_USER'),
    password: readRequired('DB_PASSWORD'),
    connectionLimit: readInteger('DB_CONNECTION_LIMIT', 10),
  }),
  auth: Object.freeze({
    tokenSecret: readRequired('AUTH_TOKEN_SECRET'),
    tokenTtlSeconds: readInteger('AUTH_TOKEN_TTL_SECONDS', 28_800),
  }),
  ai: Object.freeze({
    baseUrl: readOptional('AI_SERVICE_URL', 'http://127.0.0.1:8001'),
    timeoutMs: readInteger('AI_TIMEOUT_MS', 2_500),
  }),
});
