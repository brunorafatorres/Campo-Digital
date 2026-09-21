function parseReference(value) {
  if (!value) return {};
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch {
    return {};
  }
}

function present(row) {
  if (!row) return null;
  return {
    id: row.id,
    periodo_inicio: row.periodo_inicio,
    periodo_fim: row.periodo_fim,
    tipo: row.tipo,
    titulo: row.titulo,
    mensagem: row.mensagem,
    dados_referencia: parseReference(row.dados_referencia),
    gerado_por_ia: Boolean(row.es_sugerencia),
    foi_util: row.foi_util === null || row.foi_util === undefined ? null : Boolean(row.foi_util),
    avaliado_em: row.avaliado_em ?? null,
    criado_em: row.criado_em,
  };
}

const SUMMARY_SQL = `SELECT COUNT(*) AS quantidade,
  CAST(COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN valor ELSE 0 END), 0) AS CHAR) AS receitas,
  CAST(COALESCE(SUM(CASE WHEN tipo = 'GASTO' THEN valor ELSE 0 END), 0) AS CHAR) AS despesas,
  CAST(COALESCE(SUM(CASE WHEN tipo = 'INGRESO' THEN valor ELSE -valor END), 0) AS CHAR) AS saldo
  FROM movimientos_financieros
 WHERE usuario_id = ? AND fecha BETWEEN ? AND ?`;

export function createInsightRepository(database) {
  return {
    async getPreferences(userId) {
      const [rows] = await database.execute(
        `SELECT alertas_activas, frecuencia,
                CAST(porcentaje_variacion AS CHAR) AS percentual_variacao
           FROM preferencias_alertas
          WHERE usuario_id = ? LIMIT 1`,
        [userId],
      );
      if (!rows[0]) {
        return { alertas_ativas: true, frequencia: 'SEMANAL', percentual_variacao: '20.00' };
      }
      return {
        alertas_ativas: Boolean(rows[0].alertas_activas),
        frequencia: rows[0].frecuencia,
        percentual_variacao: rows[0].percentual_variacao,
      };
    },

    async savePreferences(userId, preferences) {
      await database.execute(
        `INSERT INTO preferencias_alertas
          (usuario_id, alertas_activas, frecuencia, porcentaje_variacion)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE alertas_activas = VALUES(alertas_activas),
           frecuencia = VALUES(frecuencia), porcentaje_variacion = VALUES(porcentaje_variacion)`,
        [userId, preferences.alertas_ativas, preferences.frequencia,
          preferences.percentual_variacao],
      );
      return this.getPreferences(userId);
    },

    async summarize(userId, inicio, fim) {
      const [rows] = await database.execute(SUMMARY_SQL, [userId, inicio, fim]);
      return rows[0];
    },

    async expenseCategories(userId, inicio, fim) {
      const [rows] = await database.execute(
        `SELECT m.categoria_id, c.nombre AS categoria, COUNT(*) AS quantidade,
                CAST(SUM(m.valor) AS CHAR) AS total
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE m.usuario_id = ? AND m.tipo = 'GASTO' AND m.fecha BETWEEN ? AND ?
          GROUP BY m.categoria_id, c.nombre
          ORDER BY SUM(m.valor) DESC, c.nombre ASC`,
        [userId, inicio, fim],
      );
      return rows;
    },

    async periodMovements(userId, inicio, fim) {
      const [rows] = await database.execute(
        `SELECT m.id, m.categoria_id, c.nombre AS categoria, m.tipo, m.descripcion,
                CAST(m.valor AS CHAR) AS valor, DATE_FORMAT(m.fecha, '%Y-%m-%d') AS data
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE m.usuario_id = ? AND m.fecha BETWEEN ? AND ?
          ORDER BY m.fecha DESC, m.id DESC`,
        [userId, inicio, fim],
      );
      return rows;
    },

    async historicalStats(userId, inicioHistorico, fimHistorico) {
      const [rows] = await database.execute(
        `SELECT categoria_id, tipo, COUNT(*) AS quantidade,
                CAST(AVG(valor) AS CHAR) AS media,
                CAST(COALESCE(STDDEV_POP(valor), 0) AS CHAR) AS desvio_padrao
           FROM movimientos_financieros
          WHERE usuario_id = ? AND fecha BETWEEN ? AND ?
          GROUP BY categoria_id, tipo`,
        [userId, inicioHistorico, fimHistorico],
      );
      return rows;
    },

    async create(userId, data) {
      const [result] = await database.execute(
        `INSERT INTO insights_financieros
          (usuario_id, periodo_inicio, periodo_fin, tipo, titulo, mensaje, datos_referencia, es_sugerencia)
         VALUES (?, ?, ?, 'RESUMEN', ?, ?, ?, TRUE)`,
        [userId, data.periodo_inicio, data.periodo_fim, data.titulo, data.mensagem,
          JSON.stringify(data.dados_referencia)],
      );
      return this.findOwned(userId, result.insertId);
    },

    async findOwned(userId, id) {
      const [rows] = await database.execute(
        `SELECT id, DATE_FORMAT(periodo_inicio, '%Y-%m-%d') AS periodo_inicio,
                DATE_FORMAT(periodo_fin, '%Y-%m-%d') AS periodo_fim, tipo, titulo,
                mensaje AS mensagem, datos_referencia, es_sugerencia, foi_util,
                DATE_FORMAT(avaliado_em, '%Y-%m-%dT%H:%i:%sZ') AS avaliado_em,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%sZ') AS criado_em
           FROM insights_financieros
          WHERE id = ? AND usuario_id = ? LIMIT 1`,
        [id, userId],
      );
      return present(rows[0]);
    },

    async rate(userId, id, useful) {
      const [result] = await database.execute(
        `UPDATE insights_financieros
            SET foi_util = ?, avaliado_em = CURRENT_TIMESTAMP
          WHERE id = ? AND usuario_id = ?`,
        [useful, id, userId],
      );
      if (!result.affectedRows) return null;
      return this.findOwned(userId, id);
    },

    async listByUser(userId, limit = 20) {
      const [rows] = await database.execute(
        `SELECT id, DATE_FORMAT(periodo_inicio, '%Y-%m-%d') AS periodo_inicio,
                DATE_FORMAT(periodo_fin, '%Y-%m-%d') AS periodo_fim, tipo, titulo,
                mensaje AS mensagem, datos_referencia, es_sugerencia, foi_util,
                DATE_FORMAT(avaliado_em, '%Y-%m-%dT%H:%i:%sZ') AS avaliado_em,
                DATE_FORMAT(creado_en, '%Y-%m-%dT%H:%i:%sZ') AS criado_em
           FROM insights_financieros
          WHERE usuario_id = ?
          ORDER BY creado_en DESC, id DESC
          LIMIT ?`,
        [userId, String(limit)],
      );
      return rows.map(present);
    },
  };
}
