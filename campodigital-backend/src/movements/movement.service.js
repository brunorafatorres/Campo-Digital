const TYPES = new Set(['INGRESO', 'GASTO']);
const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function readId(value, label = 'Identificador') {
  if (!['string', 'number'].includes(typeof value)
      || !/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) {
    throw fail(`${label} inválido.`);
  }
  return Number(value);
}

function readType(value) {
  if (!TYPES.has(value)) throw fail('Selecione Receita ou Despesa.');
  return value;
}

function readDate(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{3}-\d{2}-\d{2}$/.test(value)) {
    throw fail('Informe uma data válida no formato AAAA-MM-DD.');
  }
  const date = new Date(`${value}T00:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    throw fail('Informe uma data válida no calendário.');
  }
  return value;
}

function readAmount(value) {
  if (!['string', 'number'].includes(typeof value)) throw fail('Informe um valor positivo.');
  const text = String(value).trim().replace(',', '.');
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(text)) {
    throw fail('Use um valor positivo com até 12 dígitos inteiros e duas casas decimais.');
  }
  const [whole, decimal = ''] = text.split('.');
  const cents = BigInt(whole) * 100n + BigInt(decimal.padEnd(2, '0'));
  if (cents <= 0n) throw fail('O valor deve ser maior que zero.');
  return `${BigInt(whole)}.${decimal.padEnd(2, '0')}`;
}

function readFilters(query = {}) {
  const present = (value) => value !== undefined && value !== '';
  const filters = {
    desde: present(query.desde) ? readDate(query.desde) : null,
    hasta: present(query.hasta) ? readDate(query.hasta) : null,
    tipo: present(query.tipo) ? readType(query.tipo) : null,
    categoria_id: present(query.categoria_id) ? readId(query.categoria_id, 'Categoria') : null,
    pagina: present(query.pagina) ? readId(query.pagina, 'Número da página') : 1,
    limite: 20,
  };
  if (filters.desde && filters.hasta && filters.desde > filters.hasta) {
    throw fail('A data inicial deve ser anterior ou igual à data final.');
  }
  if (filters.pagina > 1000000) throw fail('Número da página fora do limite.');
  return filters;
}

function normalize(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw fail('Informe os dados da movimentação.');
  }
  const descripcion = typeof input.descripcion === 'string' ? input.descripcion.trim() : '';
  if (descripcion.length < 2 || descripcion.length > 255) {
    throw fail('A descrição deve ter entre 2 e 255 caracteres.');
  }
  return {
    tipo: readType(input.tipo),
    categoria_id: readId(input.categoria_id, 'Categoria'),
    descripcion,
    valor: readAmount(input.valor),
    fecha: readDate(input.fecha),
  };
}

export function createMovementService(repository) {
  async function checkCategory(userId, data, existing = null) {
    const category = await repository.findVisibleCategory(userId, data.categoria_id);
    if (!category) throw fail('Categoria indisponível para este produtor.');
    if (category.tipo !== data.tipo) throw fail('A categoria deve corresponder ao tipo da movimentação.');
    // An archived category can remain on its own historical movement.
    const retained = existing && String(existing.categoria_id) === String(category.id)
      && existing.tipo === data.tipo;
    if (!category.activa && !retained) throw fail('Selecione uma categoria ativa.');
  }

  return {
    async list(userId, query) {
      const filters = readFilters(query);
      const [movimientos, resumen] = await Promise.all([
        repository.list(userId, filters), repository.summarize(userId, filters),
      ]);
      return {
        movimientos, resumen,
        paginacion: {
          pagina: filters.pagina, limite: filters.limite, total: Number(resumen.cantidad),
          total_paginas: Math.max(1, Math.ceil(Number(resumen.cantidad) / filters.limite)),
        },
      };
    },

    summarize(userId, query) {
      return repository.summarize(userId, readFilters(query));
    },

    async create(userId, input) {
      const data = normalize(input);
      await checkCategory(userId, data);
      return repository.create(userId, data);
    },

    async update(userId, value, input) {
      const id = readId(value);
      const existing = await repository.findOwned(userId, id);
      if (!existing) throw fail('Movimentação não encontrada.', 404);
      const data = normalize(input);
      await checkCategory(userId, data, existing);
      const updated = await repository.update(userId, id, data);
      if (!updated) throw fail('Movimentação não encontrada.', 404);
      return updated;
    },

    async remove(userId, value) {
      if (!(await repository.remove(userId, readId(value)))) {
        throw fail('Movimentação não encontrada.', 404);
      }
    },
  };
}
