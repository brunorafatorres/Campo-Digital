function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function normalize(input, existing = {}) {
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : existing.nombre;
  const descripcion = input.descripcion === undefined
    ? (existing.descripcion ?? null)
    : (typeof input.descripcion === 'string' ? input.descripcion.trim() || null : null);
  const activa = input.activa === undefined ? Boolean(existing.activa ?? true) : input.activa;
  const tipo_producao = input.tipo_producao === undefined ? (existing.tipo_producao ?? null) : String(input.tipo_producao).trim() || null;
  const produtos_trabalhados = input.produtos_trabalhados === undefined ? (existing.produtos_trabalhados ?? null) : String(input.produtos_trabalhados).trim() || null;
  const porte_producao = input.porte_producao === undefined ? (existing.porte_producao ?? null) : String(input.porte_producao).trim() || null;

  if (!nombre || nombre.length < 2 || nombre.length > 120) {
    throw badRequest('A atividade deve ter entre 2 e 120 caracteres.');
  }
  if (descripcion && descripcion.length > 500) {
    throw badRequest('A descrição não pode ultrapassar 500 caracteres.');
  }
  if (typeof activa !== 'boolean') {
    throw badRequest('O estado da atividade não é válido.');
  }
  if (tipo_producao && (tipo_producao.length < 2 || tipo_producao.length > 80)) throw badRequest('O tipo de atividade deve ter entre 2 e 80 caracteres.');
  if (produtos_trabalhados && (produtos_trabalhados.length < 2 || produtos_trabalhados.length > 180)) throw badRequest('Informe os produtos em até 180 caracteres.');
  if (porte_producao && !['PEQUENA', 'MEDIA', 'GRANDE'].includes(porte_producao)) throw badRequest('Selecione um porte válido.');

  return { nombre, descripcion, activa, tipo_producao, produtos_trabalhados, porte_producao };
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
          throw Object.assign(new Error('Já existe uma atividade com esse nome.'), { status: 409 });
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
          throw Object.assign(new Error('Já existe uma atividade com esse nome.'), { status: 409 });
        }
        throw error;
      }
    },
  };
}
