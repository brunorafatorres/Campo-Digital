import mysql from 'mysql2/promise';

import { env } from '../src/config/env.js';

const email = String(process.env.DEMO_EMAIL || '').trim().toLowerCase();
if (!email) {
  throw new Error('Informe DEMO_EMAIL antes de executar.');
}

const dateAt = (days) => {
  const value = new Date();
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
};

const today = dateAt(0);
const fiveDaysAgo = dateAt(-5);
const tenDaysAgo = dateAt(-10);

const connection = await mysql.createConnection({
  host: env.database.host,
  port: env.database.port,
  user: env.database.user,
  password: env.database.password,
  database: env.database.name,
});

try {
  await connection.beginTransaction();

  const [users] = await connection.execute(
    'SELECT id FROM usuarios WHERE email = ? LIMIT 1',
    [email],
  );
  if (!users[0]) {
    throw new Error(`Usuario nao encontrado: ${email}`);
  }

  const userId = users[0].id;

  const [activities] = await connection.execute(
    `SELECT id FROM actividades_productivas
      WHERE usuario_id = ?
      ORDER BY id
      LIMIT 1`,
    [userId],
  );
  let activityId = activities[0]?.id;
  if (!activityId) {
    const [result] = await connection.execute(
      `INSERT INTO actividades_productivas (usuario_id, nombre, descripcion)
       VALUES (?, ?, ?)`,
      [
        userId,
        'Produ\u00e7\u00e3o de soja e milho',
        'Produ\u00e7\u00e3o familiar de gr\u00e3os para comercializa\u00e7\u00e3o local.',
      ],
    );
    activityId = result.insertId;
  } else {
    await connection.execute(
      `UPDATE actividades_productivas
          SET nombre = ?, descripcion = ?, activa = TRUE
        WHERE id = ? AND usuario_id = ?`,
      [
        'Produ\u00e7\u00e3o de soja e milho',
        'Produ\u00e7\u00e3o familiar de gr\u00e3os para comercializa\u00e7\u00e3o local.',
        activityId,
        userId,
      ],
    );
  }

  async function category(name, type) {
    const [found] = await connection.execute(
      `SELECT id FROM categorias_financieras
        WHERE usuario_id = ? AND nombre = ? AND tipo = ?
        LIMIT 1`,
      [userId, name, type],
    );
    if (found[0]) return found[0].id;

    const [result] = await connection.execute(
      `INSERT INTO categorias_financieras
        (usuario_id, nombre, tipo, es_sistema, activa)
       VALUES (?, ?, ?, FALSE, TRUE)`,
      [userId, name, type],
    );
    return result.insertId;
  }

  const saleCategory = await category('Venda de gr\u00e3os', 'INGRESO');
  const fertilizerCategory = await category('Fertilizantes e insumos', 'GASTO');
  const fuelCategory = await category('Combust\u00edvel', 'GASTO');
  const maintenanceCategory = await category('Manuten\u00e7\u00e3o de m\u00e1quinas', 'GASTO');

  async function movement(categoryId, type, value, date, description) {
    const [found] = await connection.execute(
      `SELECT id FROM movimientos_financieros
        WHERE usuario_id = ? AND descripcion = ?
        LIMIT 1`,
      [userId, description],
    );
    if (found[0]) return;

    await connection.execute(
      `INSERT INTO movimientos_financieros
        (usuario_id, actividad_productiva_id, categoria_id, tipo, valor, fecha, descripcion)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, activityId, categoryId, type, value, date, description],
    );
  }

  await movement(saleCategory, 'INGRESO', 8500, today, 'Venda de produ\u00e7\u00e3o de soja');
  await movement(fertilizerCategory, 'GASTO', 2100, fiveDaysAgo, 'Compra de fertilizantes');
  await movement(fuelCategory, 'GASTO', 780, tenDaysAgo, 'Combust\u00edvel para m\u00e1quinas');
  await movement(maintenanceCategory, 'GASTO', 460, tenDaysAgo, 'Manuten\u00e7\u00e3o de equipamento');

  await connection.execute(
    `INSERT INTO preferencias_alertas
      (usuario_id, alertas_activas, frecuencia, porcentaje_variacion)
     VALUES (?, TRUE, 'SEMANAL', 20.00)
     ON DUPLICATE KEY UPDATE
       alertas_activas = TRUE,
       frecuencia = 'SEMANAL',
       porcentaje_variacion = 20.00`,
    [userId],
  );

  const [insights] = await connection.execute(
    `SELECT id FROM insights_financieros
      WHERE usuario_id = ? AND titulo = ?
      LIMIT 1`,
    [userId, 'Resumo da demonstra\u00e7\u00e3o'],
  );
  if (!insights[0]) {
    const reference = {
      periodo_atual: {
        inicio: tenDaysAgo,
        fim: today,
        receitas: '8500.00',
        despesas: '3340.00',
        saldo: '5160.00',
      },
      alertas_despesas: [
        {
          categoria: 'Fertilizantes e insumos',
          percentual_aumento: 35,
        },
      ],
      movimentacoes_atipicas: [],
    };
    await connection.execute(
      `INSERT INTO insights_financieros
        (usuario_id, periodo_inicio, periodo_fin, tipo, titulo, mensaje, datos_referencia, es_sugerencia)
       VALUES (?, ?, ?, 'RESUMO', ?, ?, ?, TRUE)`,
      [
        userId,
        tenDaysAgo,
        today,
        'Resumo da demonstra\u00e7\u00e3o',
        'Sua demonstra\u00e7\u00e3o possui receitas, despesas e um alerta para revis\u00e3o.',
        JSON.stringify(reference),
      ],
    );
  }

  await connection.commit();
  console.log('Dados de demonstra\u00e7\u00e3o preparados com sucesso.');
  console.log('Perfil, produ\u00e7\u00e3o, categorias, movimenta\u00e7\u00f5es, totais e alertas foram carregados.');
} catch (error) {
  await connection.rollback();
  throw error;
} finally {
  await connection.end();
}
