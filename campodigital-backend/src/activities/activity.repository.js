export function createActivityRepository(database) {
  return {
    async listByUser(userId) {
      const [rows] = await database.execute(
        `SELECT id, nombre, descripcion, activa, creado_en, actualizado_en
           FROM actividades_productivas
          WHERE usuario_id = ?
          ORDER BY activa DESC, nombre ASC`,
        [userId],
      );
      return rows;
    },

    async create(userId, data) {
      const [result] = await database.execute(
        `INSERT INTO actividades_productivas (usuario_id, nombre, descripcion)
         VALUES (?, ?, ?)`,
        [userId, data.nombre, data.descripcion],
      );
      return this.findById(userId, result.insertId);
    },

    async findById(userId, id) {
      const [rows] = await database.execute(
        `SELECT id, nombre, descripcion, activa, creado_en, actualizado_en
           FROM actividades_productivas
          WHERE id = ? AND usuario_id = ?
          LIMIT 1`,
        [id, userId],
      );
      return rows[0] ?? null;
    },

    async update(userId, id, data) {
      const [result] = await database.execute(
        `UPDATE actividades_productivas
            SET nombre = ?, descripcion = ?, activa = ?
          WHERE id = ? AND usuario_id = ?`,
        [data.nombre, data.descripcion, data.activa, id, userId],
      );
      return result.affectedRows ? this.findById(userId, id) : null;
    },
  };
}
