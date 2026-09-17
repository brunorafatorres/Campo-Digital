const COLUMNS = `m.id, m.categoria_id, m.categoria_sugerida_id,
  CAST(m.confianza_ia AS CHAR) AS confianza_ia, m.tipo, m.descripcion,
  CAST(m.valor AS CHAR) AS valor, DATE_FORMAT(m.fecha, '%Y-%m-%d') AS fecha,
  c.nombre AS categoria, c.activa AS categoria_activa`;

function where(userId, filters) {
  const clauses = ['m.usuario_id = ?'];
  const params = [userId];
  for (const [key, expression] of [
    ['desde', 'm.fecha >= ?'], ['hasta', 'm.fecha <= ?'],
    ['tipo', 'm.tipo = ?'], ['categoria_id', 'm.categoria_id = ?'],
  ]) {
    if (filters[key] !== null && filters[key] !== undefined) {
      clauses.push(expression);
      params.push(filters[key]);
    }
  }
  return { sql: clauses.join(' AND '), params };
}

export function createMovementRepository(database) {
  return {
    async list(userId, filters) {
      const clause = where(userId, filters);
      const [rows] = await database.execute(
        `SELECT ${COLUMNS}
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE ${clause.sql}
          ORDER BY m.fecha DESC, m.id DESC
          LIMIT ? OFFSET ?`,
        [...clause.params, String(filters.limite), String((filters.pagina - 1) * filters.limite)],
      );
      return rows;
    },

    async summarize(userId, filters) {
      const clause = where(userId, filters);
      const [rows] = await database.execute(
        `SELECT COUNT(*) AS cantidad,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.valor ELSE 0 END), 0) AS CHAR) AS total_ingresos,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'GASTO' THEN m.valor ELSE 0 END), 0) AS CHAR) AS total_gastos,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.valor ELSE -m.valor END), 0) AS CHAR) AS saldo
           FROM movimientos_financieros m
          WHERE ${clause.sql}`,
        clause.params,
      );
      return rows[0];
    },

    async summarizeByCategory(userId, filters) {
      const clause = where(userId, filters);
      const [rows] = await database.execute(
        `SELECT m.categoria_id, c.nombre AS categoria, m.tipo,
                COUNT(*) AS cantidad,
                CAST(SUM(m.valor) AS CHAR) AS total
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE ${clause.sql}
          GROUP BY m.categoria_id, c.nombre, m.tipo
          ORDER BY SUM(m.valor) DESC, c.nombre ASC`,
        clause.params,
      );
      return rows;
    },

    async summarizeByMonth(userId, filters) {
      const clause = where(userId, filters);
      const [rows] = await database.execute(
        `SELECT DATE_FORMAT(m.fecha, '%Y-%m') AS periodo,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.valor ELSE 0 END), 0) AS CHAR) AS total_ingresos,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'GASTO' THEN m.valor ELSE 0 END), 0) AS CHAR) AS total_gastos,
                CAST(COALESCE(SUM(CASE WHEN m.tipo = 'INGRESO' THEN m.valor ELSE -m.valor END), 0) AS CHAR) AS saldo
           FROM movimientos_financieros m
          WHERE ${clause.sql}
          GROUP BY DATE_FORMAT(m.fecha, '%Y-%m')
          ORDER BY periodo ASC`,
        clause.params,
      );
      return rows;
    },

    async findOwned(userId, id) {
      const [rows] = await database.execute(
        `SELECT ${COLUMNS}
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE m.id = ? AND m.usuario_id = ? LIMIT 1`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async findVisibleCategory(userId, id) {
      const [rows] = await database.execute(
        `SELECT id, tipo, activa FROM categorias_financieras
          WHERE id = ? AND (usuario_id = ? OR (usuario_id IS NULL AND es_sistema = TRUE))
          LIMIT 1`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async create(userId, data) {
      const [result] = await database.execute(
        `INSERT INTO movimientos_financieros
          (usuario_id, categoria_id, categoria_sugerida_id, confianza_ia, tipo, descripcion, valor, fecha)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [userId, data.categoria_id, data.categoria_sugerida_id, data.confianza_ia,
          data.tipo, data.descripcion, data.valor, data.fecha],
      );
      return this.findOwned(userId, result.insertId);
    },

    async update(userId, id, data) {
      await database.execute(
        `UPDATE movimientos_financieros
            SET categoria_id = ?, categoria_sugerida_id = ?, confianza_ia = ?,
                tipo = ?, descripcion = ?, valor = ?, fecha = ?
          WHERE id = ? AND usuario_id = ?`,
        [data.categoria_id, data.categoria_sugerida_id, data.confianza_ia,
          data.tipo, data.descripcion, data.valor, data.fecha, id, userId],
      );
      return this.findOwned(userId, id);
    },

    async remove(userId, id) {
      const [result] = await database.execute(
        'DELETE FROM movimientos_financieros WHERE id = ? AND usuario_id = ?',
        [id, userId],
      );
      return result.affectedRows > 0;
    },
  };
}
