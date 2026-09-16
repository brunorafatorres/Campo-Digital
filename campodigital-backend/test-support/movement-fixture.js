// Isolated data for automated tests; this repository never connects to MySQL.
export function createMovementFixture() {
  const categories = [
    { id: 1, usuario_id: null, nombre: 'Venda de produção', tipo: 'INGRESO', activa: true },
    { id: 2, usuario_id: '7', nombre: 'Ração', tipo: 'GASTO', activa: true },
    { id: 3, usuario_id: '7', nombre: 'Categoria antiga', tipo: 'GASTO', activa: false },
    { id: 4, usuario_id: '8', nombre: 'Privada de outro produtor', tipo: 'GASTO', activa: true },
  ];
  const rows = [];
  let nextId = 1;
  const visible = (userId, id) => categories.find((item) => String(item.id) === String(id)
    && (item.usuario_id === null || item.usuario_id === String(userId))) ?? null;
  const owned = (userId, id) => rows.find((row) => row.usuario_id === String(userId) && row.id === Number(id)) ?? null;
  const select = (userId, filter) => rows.filter((row) => row.usuario_id === String(userId)
    && (!filter.desde || row.fecha >= filter.desde) && (!filter.hasta || row.fecha <= filter.hasta)
    && (!filter.tipo || row.tipo === filter.tipo)
    && (!filter.categoria_id || row.categoria_id === filter.categoria_id));
  const present = (row) => {
    if (!row) return null;
    const category = categories.find((item) => item.id === row.categoria_id);
    return { ...row, categoria: category.nombre, categoria_activa: category.activa };
  };
  const amount = (cents) => `${cents < 0n ? '-' : ''}${(cents < 0n ? -cents : cents) / 100n}.${String((cents < 0n ? -cents : cents) % 100n).padStart(2, '0')}`;
  const repository = {
    async findVisibleCategory(userId, id) { return visible(userId, id); },
    async findOwned(userId, id) { return present(owned(userId, id)); },
    async create(userId, data) {
      const row = { ...data, id: nextId++, usuario_id: String(userId) };
      rows.push(row);
      return present(row);
    },
    async update(userId, id, data) {
      const row = owned(userId, id);
      if (row) Object.assign(row, data);
      return present(row);
    },
    async remove(userId, id) {
      const row = owned(userId, id);
      if (!row) return false;
      rows.splice(rows.indexOf(row), 1);
      return true;
    },
    async list(userId, filters) {
      const start = (filters.pagina - 1) * filters.limite;
      return select(userId, filters).sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)
        .slice(start, start + filters.limite).map(present);
    },
    async summarize(userId, filters) {
      const items = select(userId, filters);
      let income = 0n; let expense = 0n;
      for (const row of items) {
        const cents = BigInt(row.valor.replace('.', ''));
        if (row.tipo === 'INGRESO') income += cents;
        else expense += cents;
      }
      return { cantidad: items.length, total_ingresos: amount(income), total_gastos: amount(expense), saldo: amount(income - expense) };
    },
    async summarizeByCategory(userId, filters) {
      const grouped = new Map();
      for (const row of select(userId, filters)) {
        const key = `${row.categoria_id}:${row.tipo}`;
        const current = grouped.get(key) ?? { categoria_id: row.categoria_id,
          categoria: visible(userId, row.categoria_id).nombre, tipo: row.tipo, cantidad: 0, cents: 0n };
        current.cantidad++;
        current.cents += BigInt(row.valor.replace('.', ''));
        grouped.set(key, current);
      }
      return [...grouped.values()].sort((a, b) => (a.cents === b.cents
        ? a.categoria.localeCompare(b.categoria) : (a.cents > b.cents ? -1 : 1)))
        .map(({ cents, ...item }) => ({ ...item, total: amount(cents) }));
    },
    async summarizeByMonth(userId, filters) {
      const grouped = new Map();
      for (const row of select(userId, filters)) {
        const key = row.fecha.slice(0, 7);
        const current = grouped.get(key) ?? { periodo: key, income: 0n, expense: 0n };
        if (row.tipo === 'INGRESO') current.income += BigInt(row.valor.replace('.', ''));
        else current.expense += BigInt(row.valor.replace('.', ''));
        grouped.set(key, current);
      }
      return [...grouped.values()].sort((a, b) => a.periodo.localeCompare(b.periodo)).map((item) => ({
        periodo: item.periodo, total_ingresos: amount(item.income), total_gastos: amount(item.expense),
        saldo: amount(item.income - item.expense),
      }));
    },
  };
  return { repository, categories, rows };
}
