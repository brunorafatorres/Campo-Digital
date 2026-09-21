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
    throw badRequest('O tipo deve ser INGRESO ou GASTO.');
  }
  return tipo;
}

export function createCategoryService(repository) {
  return {
    list(userId, tipo, incluirInativas) {
      if (incluirInativas !== undefined && !['true', 'false'].includes(incluirInativas)) {
        throw badRequest('O filtro de categorias inativas deve ser true ou false.');
      }
      return repository.listVisible(userId, readType(tipo, true), incluirInativas === 'true');
    },

    async create(userId, input = {}) {
      const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
      if (nombre.length < 2 || nombre.length > 100) {
        throw badRequest('A categoria deve ter entre 2 e 100 caracteres.');
      }

      try {
        return await repository.create(userId, { nombre, tipo: readType(input.tipo) });
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw Object.assign(new Error('Já existe uma categoria com esse nome e tipo.'), { status: 409 });
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
