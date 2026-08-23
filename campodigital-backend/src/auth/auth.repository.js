export function createAuthRepository(database) {
  return {
    async findByEmail(email) {
      const [rows] = await database.execute(
        `SELECT id, nombre, email, password_hash, rol, activo
           FROM usuarios
          WHERE email = ?
          LIMIT 1`,
        [email],
      );

      return rows[0] ?? null;
    },

    async findPublicById(id) {
      const [rows] = await database.execute(
        `SELECT id, nombre, email, rol, activo, creado_en, actualizado_en
           FROM usuarios
          WHERE id = ?
          LIMIT 1`,
        [id],
      );

      return rows[0] ?? null;
    },

    async createUser({ nombre, email, passwordHash }) {
      const [result] = await database.execute(
        `INSERT INTO usuarios (nombre, email, password_hash, rol)
         VALUES (?, ?, ?, 'PRODUCTOR')`,
        [nombre, email, passwordHash],
      );

      return this.findPublicById(result.insertId);
    },
  };
}
