const VALID_TYPES = new Set(['INGRESO', 'GASTO']);

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function readType(value, optional = false) {
  if (optional && (value === undefined || value === '')) {
    return null;
  }
  const tipo = typeof value === 'string' ? value.trim().toUpperCase() : '';
  if (!VALID_TYPES.has(tipo)) {
    throw badRequest('El tipo debe ser INGRESO o GASTO.');
  }
  return tipo;
}

export function createCategoryService(repository) {
  return {
    list(userId, tipo) {
      return repository.listVisible(userId, readType(tipo, true));
    },

    async create(userId, input = {}) {
      const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
      if (nombre.length < 2 || nombre.length > 100) {
        throw badRequest('La categoría debe tener entre 2 y 100 caracteres.');
      }

      try {
        return await repository.create(userId, { nombre, tipo: readType(input.tipo) });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw Object.assign(new Error('Ya existe una categoría con ese nombre y tipo.'), { status: 409 });
        }
        throw error;
      }
    },

    async deactivate(userId, id) {
      if (!(await repository.deactivate(userId, id))) {
        throw Object.assign(new Error('Categoría propia no encontrada.'), { status: 404 });
      }
    },
  };
}
