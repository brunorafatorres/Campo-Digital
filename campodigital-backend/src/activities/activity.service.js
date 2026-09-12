function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function normalize(input, existing = {}) {
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : existing.nombre;
  const descripcion = input.descripcion === undefined
    ? (existing.descripcion ?? null)
    : (typeof input.descripcion === 'string' ? input.descripcion.trim() || null : null);
  const activa = input.activa === undefined ? Boolean(existing.activa ?? true) : input.activa;

  if (!nombre || nombre.length < 2 || nombre.length > 120) {
    throw badRequest('La actividad debe tener entre 2 y 120 caracteres.');
  }
  if (descripcion && descripcion.length > 500) {
    throw badRequest('La descripción no puede superar los 500 caracteres.');
  }
  if (typeof activa !== 'boolean') {
    throw badRequest('El estado de la actividad no es válido.');
  }

  return { nombre, descripcion, activa };
}

export function createActivityService(repository) {
  return {
    list(userId) {
      return repository.listByUser(userId);
    },

    async create(userId, input = {}) {
      try {
        return await repository.create(userId, normalize(input));
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw Object.assign(new Error('Ya existe una actividad con ese nombre.'), { status: 409 });
        }
        throw error;
      }
    },

    async update(userId, id, input = {}) {
      const current = await repository.findById(userId, id);
      if (!current) {
        throw Object.assign(new Error('Actividad no encontrada.'), { status: 404 });
      }

      try {
        return await repository.update(userId, id, normalize(input, current));
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw Object.assign(new Error('Ya existe una actividad con ese nombre.'), { status: 409 });
        }
        throw error;
      }
    },
  };
}
