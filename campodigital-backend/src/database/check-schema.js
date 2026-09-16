import mysql from 'mysql2/promise';

import { env } from '../config/env.js';

const required = {
  usuarios: ['id', 'nombre', 'email', 'password_hash', 'rol', 'activo'],
  actividades_productivas: ['id', 'usuario_id', 'nombre', 'descripcion', 'activa'],
  categorias_financieras: ['id', 'usuario_id', 'nombre', 'tipo', 'es_sistema', 'activa'],
  movimientos_financieros: ['id', 'usuario_id', 'categoria_id', 'tipo', 'descripcion', 'valor', 'fecha'],
};

const connection = await mysql.createConnection({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,
});

try {
  const [rows] = await connection.execute(
    `SELECT TABLE_NAME AS tableName, COLUMN_NAME AS columnName
       FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?`,
    [env.database.name],
  );
  const available = new Map();
  for (const row of rows) {
    if (!available.has(row.tableName)) available.set(row.tableName, new Set());
    available.get(row.tableName).add(row.columnName);
  }

  const missing = [];
  for (const [table, columns] of Object.entries(required)) {
    for (const column of columns) {
      if (!available.get(table)?.has(column)) missing.push(`${table}.${column}`);
    }
  }

  if (missing.length) {
    console.error('Esquema incompleto. Execute npm run db:migrate.');
    console.error(`Campos ausentes: ${missing.join(', ')}`);
    process.exitCode = 1;
  } else {
    console.log(`Esquema de ${env.database.name} compatível com o CampoDigital.`);
  }
} finally {
  await connection.end();
}
