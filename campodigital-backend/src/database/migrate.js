import { readFile } from 'node:fs/promises';

import mysql from 'mysql2/promise';

import { env } from '../config/env.js';

const migrationUrl = new URL('../../migrations/001_core.sql', import.meta.url);
const sql = await readFile(migrationUrl, 'utf8');

const connection = await mysql.createConnection({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,
  multipleStatements: true,
});

try {
  await connection.query(sql);
  console.log(`Migración 001_core aplicada en ${env.database.name}.`);
} finally {
  await connection.end();
}
