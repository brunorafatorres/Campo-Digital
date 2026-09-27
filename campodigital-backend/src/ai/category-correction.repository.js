export function createCategoryCorrectionRepository(database) {
  return {
    async listCorrections(userId, type, limit = 100) {
      const [rows] = await database.execute(
        `SELECT m.categoria_id, m.descripcion, c.nombre AS categoria
           FROM movimientos_financieros m
           JOIN categorias_financieras c ON c.id = m.categoria_id
          WHERE m.usuario_id = ?
            AND m.tipo = ?
            AND m.categoria_sugerida_id IS NOT NULL
            AND m.categoria_id <> m.categoria_sugerida_id
            AND c.activa = TRUE
          ORDER BY m.actualizado_en DESC, m.id DESC
          LIMIT ?`,
        [userId, type, String(limit)],
      );
      return rows;
    },
  };
}
