export function createCategoryRepository(database) {
  return {
    async listVisible(userId, tipo = null, includeInactive = false) {
      const params = [userId];
      let typeFilter = '';
      if (tipo) {
        typeFilter = ' AND tipo = ?';
        params.push(tipo);
      }

      const [rows] = await database.execute(
        `SELECT id, nombre, tipo, es_sistema, activa,
                CASE WHEN usuario_id IS NULL THEN 'SISTEMA' ELSE 'PROPIA' END AS origen
           FROM categorias_financieras
          WHERE (usuario_id IS NULL OR usuario_id = ?)
            ${includeInactive ? '' : 'AND activa = TRUE'}${typeFilter}
          ORDER BY es_sistema DESC, tipo ASC, nombre ASC`,
        params,
      );
      return rows;
    },

    async create(userId, data) {
      const [result] = await database.execute(
        `INSERT INTO categorias_financieras (usuario_id, nombre, tipo, es_sistema)
         VALUES (?, ?, ?, FALSE)`,
        [userId, data.nombre, data.tipo],
      );
      return this.findOwned(userId, result.insertId);
    },

    async findOwned(userId, id) {
      const [rows] = await database.execute(
        `SELECT id, nombre, tipo, es_sistema, activa, 'PROPIA' AS origen
           FROM categorias_financieras
          WHERE id = ? AND usuario_id = ? AND es_sistema = FALSE
          LIMIT 1`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async deactivate(userId, id) {
      const [result] = await database.execute(
        `UPDATE categorias_financieras
            SET activa = FALSE
          WHERE id = ? AND usuario_id = ? AND es_sistema = FALSE`,
        [id, userId],
      );
      return result.affectedRows > 0;
    },
  };
}
