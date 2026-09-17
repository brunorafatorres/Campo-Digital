export function createFinance({ api, toast, onUnauthorized }) {
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(value));
  const displayDate = (value) => value ? value.split('-').reverse().join('/') : '';
  const displayMonth = (value) => {
    const [year, month] = value.split('-').map(Number);
    return new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric', timeZone: 'UTC' })
      .format(new Date(Date.UTC(year, month - 1, 1))).replace(' de ', ' ');
  };
  const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
  let categories = [];
  let movements = [];
  let filters = {};
  let page = 1;
  let totalPages = 1;
  let editing = null;
  let pendingDelete = null;
  let aiSuggestion = null;
  let epoch = 0;
  let requestVersion = 0;

  function categoryOptions() {
    const select = $('#movement-category');
    const previous = select.value;
    const type = $('#movement-type').value;
    const available = categories.filter((item) => item.tipo === type && (item.activa
      || (editing && String(editing.categoria_id) === String(item.id) && editing.tipo === type)));
    select.innerHTML = '<option value="">Selecione uma categoria</option>' + available.map((item) =>
      `<option value="${escape(item.id)}">${escape(item.nombre)}${item.activa ? '' : ' (inativa)'}</option>`).join('');
    if (available.some((item) => String(item.id) === previous)) select.value = previous;
    $('#movement-category-help').textContent = available.length
      ? 'A categoria deve corresponder ao tipo do lançamento.'
      : 'Cadastre uma categoria deste tipo na tela Categorias.';

    const filter = $('#filter-category');
    const selected = filter.value;
    const filterType = $('#filter-type').value;
    filter.innerHTML = '<option value="">Todas as categorias</option>' + categories
      .filter((item) => !filterType || item.tipo === filterType)
      .map((item) => `<option value="${escape(item.id)}">${escape(item.nombre)}${item.activa ? '' : ' (inativa)'}</option>`).join('');
    if ([...filter.options].some((option) => option.value === selected)) filter.value = selected;
  }

  function resetForm() {
    editing = null;
    $('#movement-form').reset();
    $('#movement-date').value = localDate(new Date());
    $('#movement-form-title').textContent = 'Nova movimentação';
    $('#movement-save').textContent = 'Salvar movimentação';
    $('#movement-save').disabled = false;
    $('#movement-cancel').disabled = false;
    $('#movement-cancel').classList.add('hidden');
    $('#movement-error').textContent = '';
    clearSuggestion();
    categoryOptions();
  }

  function clearSuggestion(message = 'A sugestão é opcional e pode ser alterada antes de salvar.') {
    aiSuggestion = null;
    const status = $('#movement-ai-status');
    status.textContent = message;
    status.className = '';
  }

  async function suggestCategory() {
    const button = $('#movement-suggest-category');
    const status = $('#movement-ai-status');
    button.disabled = true;
    status.className = '';
    status.textContent = 'Analisando a descrição…';
    try {
      const result = await api('/api/ia/sugerir-categoria', {
        method: 'POST',
        body: JSON.stringify({
          descripcion: $('#movement-description').value,
          tipo: $('#movement-type').value,
        }),
      });
      const option = [...$('#movement-category').options]
        .find((item) => item.value === String(result.categoria.id));
      if (!option) throw new Error('A categoria sugerida não está disponível no formulário.');
      $('#movement-category').value = String(result.categoria.id);
      aiSuggestion = {
        categoria_sugerida_id: result.categoria.id,
        confianza_ia: result.confianca,
      };
      status.className = 'ai-success';
      status.textContent = `IA sugeriu “${result.categoria.nombre}” (${Number(result.confianca).toFixed(1)}%). Você pode alterar antes de salvar.`;
    } catch (error) {
      aiSuggestion = null;
      status.className = 'ai-error';
      status.textContent = error.message;
    } finally {
      button.disabled = false;
    }
  }

  function readFilters() {
    return { desde: $('#filter-from').value, hasta: $('#filter-to').value,
      tipo: $('#filter-type').value, categoria_id: $('#filter-category').value };
  }

  function render(result) {
    movements = result.movimientos;
    totalPages = result.paginacion.total_paginas;
    const { resumen } = result;
    $('#total-income').textContent = money(resumen.total_ingresos);
    $('#total-expense').textContent = money(resumen.total_gastos);
    $('#total-balance').textContent = money(resumen.saldo);
    $('#total-balance').classList.toggle('negative', Number(resumen.saldo) < 0);
    const period = filters.desde || filters.hasta
      ? `${displayDate(filters.desde) || 'Início'} até ${displayDate(filters.hasta) || 'sem data final'}`
      : 'Todo o período';
    $('#period-label').textContent = period;
    const type = filters.tipo ? (filters.tipo === 'INGRESO' ? 'Receitas' : 'Despesas') : '';
    const category = categories.find((item) => String(item.id) === filters.categoria_id);
    $('#dashboard-context').textContent = `${resumen.cantidad} lançamento(s) no período${type ? ` · ${type}` : ''}${category ? ` · ${category.nombre}` : ''}. Totais de todas as páginas.`;
    $('#movement-count').textContent = `${resumen.cantidad} lançamento(s)`;
    $('#movement-empty').classList.toggle('hidden', movements.length > 0);
    $('#movement-table-wrap').classList.toggle('hidden', movements.length === 0);
    $('#movement-rows').innerHTML = movements.map((item) => `<tr>
      <td>${escape(displayDate(item.fecha))}</td>
      <td class="movement-description">${escape(item.descripcion)}</td>
      <td>${escape(item.categoria)}${item.categoria_activa ? '' : ' (inativa)'}</td>
      <td><span class="type-badge ${item.tipo === 'INGRESO' ? 'income' : 'expense'}">${item.tipo === 'INGRESO' ? 'Receita' : 'Despesa'}</span></td>
      <td class="money-cell">${escape(money(item.valor))}</td>
      <td><div class="row-actions"><button type="button" data-edit-movement="${escape(item.id)}">Editar</button><button type="button" class="danger-link" data-delete-movement="${escape(item.id)}">Excluir</button></div></td>
    </tr>`).join('');
    $('#movement-page').textContent = `Página ${page} de ${totalPages}`;
    $('#movement-prev').disabled = page <= 1;
    $('#movement-next').disabled = page >= totalPages;
  }

  function renderCharts(result) {
    const categoryMax = Math.max(0, ...result.categorias.map((item) => Number(item.total)));
    $('#category-chart-empty').classList.toggle('hidden', result.categorias.length > 0);
    $('#category-chart').innerHTML = result.categorias.map((item) => {
      const percent = categoryMax ? (Number(item.total) / categoryMax) * 100 : 0;
      const type = item.tipo === 'INGRESO' ? 'income' : 'expense';
      const typeLabel = item.tipo === 'INGRESO' ? 'Receita' : 'Despesa';
      return `<div class="category-bar-item" role="listitem" aria-label="${escape(item.categoria)}: ${escape(money(item.total))}, ${typeLabel}">
        <div class="category-bar-label"><span>${escape(item.categoria)}</span><strong>${escape(money(item.total))}</strong></div>
        <div class="category-bar-track" aria-hidden="true"><span class="${type}" style="width:${percent.toFixed(2)}%"></span></div>
        <small>${typeLabel} · ${item.cantidad} lançamento(s)</small>
      </div>`;
    }).join('');

    const periodMax = Math.max(0, ...result.periodos.flatMap((item) =>
      [Number(item.total_ingresos), Number(item.total_gastos)]));
    $('#period-chart-empty').classList.toggle('hidden', result.periodos.length > 0);
    $('#period-chart').innerHTML = result.periodos.map((item) => {
      const income = Number(item.total_ingresos);
      const expense = Number(item.total_gastos);
      const incomeHeight = periodMax ? Math.max(income > 0 ? 2 : 0, (income / periodMax) * 100) : 0;
      const expenseHeight = periodMax ? Math.max(expense > 0 ? 2 : 0, (expense / periodMax) * 100) : 0;
      return `<div class="period-group" role="listitem" aria-label="${escape(displayMonth(item.periodo))}: receitas ${escape(money(income))}, despesas ${escape(money(expense))}, saldo ${escape(money(item.saldo))}">
        <div class="period-bars" aria-hidden="true">
          <span class="period-bar income" style="height:${incomeHeight.toFixed(2)}%" title="Receitas: ${escape(money(income))}"></span>
          <span class="period-bar expense" style="height:${expenseHeight.toFixed(2)}%" title="Despesas: ${escape(money(expense))}"></span>
        </div>
        <strong>${escape(displayMonth(item.periodo))}</strong><small>Saldo ${escape(money(item.saldo))}</small>
      </div>`;
    }).join('');
  }

  async function refresh() {
    const version = ++requestVersion;
    const session = epoch;
    $('#movement-list-error').textContent = '';
    $('#movement-loading').classList.remove('hidden');
    $('#movement-results').classList.add('hidden');
    for (const id of ['total-income', 'total-expense', 'total-balance']) $(`#${id}`).textContent = '…';
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      query.set('pagina', String(page));
      const [result, charts] = await Promise.all([
        api(`/api/movimientos?${query}`),
        api(`/api/movimientos/graficos?${query}`),
      ]);
      if (version !== requestVersion || session !== epoch) return;
      if (page > result.paginacion.total_paginas) {
        page = result.paginacion.total_paginas;
        return await refresh();
      }
      render(result);
      renderCharts(charts);
      $('#movement-results').classList.remove('hidden');
    } catch (error) {
      if (version !== requestVersion || session !== epoch) return;
      if (error.status === 401) { onUnauthorized(); toast('Sua sessão expirou. Entre novamente.'); return; }
      $('#movement-list-error').textContent = error.message;
      $('#dashboard-context').textContent = 'Não foi possível carregar os totais. Tente novamente em Movimentações.';
      $('#category-chart').replaceChildren();
      $('#period-chart').replaceChildren();
      $('#category-chart-empty').classList.remove('hidden');
      $('#period-chart-empty').classList.remove('hidden');
      for (const id of ['total-income', 'total-expense', 'total-balance']) $(`#${id}`).textContent = '—';
    } finally {
      if (version === requestVersion && session === epoch) $('#movement-loading').classList.add('hidden');
    }
  }

  async function save(event) {
    event.preventDefault();
    if ($('#movement-save').disabled) return;
    const session = epoch;
    const id = editing?.id;
    $('#movement-error').textContent = '';
    $('#movement-save').disabled = true;
    $('#movement-cancel').disabled = true;
    try {
      await api(id ? `/api/movimientos/${id}` : '/api/movimientos', {
        method: id ? 'PUT' : 'POST',
        body: JSON.stringify({ tipo: $('#movement-type').value, categoria_id: $('#movement-category').value,
          descripcion: $('#movement-description').value, valor: $('#movement-value').value,
          fecha: $('#movement-date').value, ...(aiSuggestion ?? {}) }),
      });
      if (session !== epoch) return;
      resetForm();
      toast(id ? 'Movimentação atualizada.' : 'Movimentação cadastrada.');
      await refresh();
    } catch (error) {
      if (session !== epoch) return;
      if (error.status === 401) { onUnauthorized(); toast('Sua sessão expirou. Entre novamente.'); return; }
      $('#movement-error').textContent = error.message;
    } finally {
      if (session === epoch) {
        $('#movement-save').disabled = false;
        $('#movement-cancel').disabled = false;
      }
    }
  }

  $('#movement-form').addEventListener('submit', save);
  $('#movement-suggest-category').addEventListener('click', suggestCategory);
  $('#movement-cancel').addEventListener('click', resetForm);
  $('#movement-type').addEventListener('change', () => { clearSuggestion(); categoryOptions(); });
  $('#movement-description').addEventListener('input', () => {
    if (aiSuggestion) clearSuggestion('Descrição alterada. Solicite uma nova sugestão se desejar.');
  });
  $('#movement-category').addEventListener('change', () => {
    if (aiSuggestion && String(aiSuggestion.categoria_sugerida_id) !== $('#movement-category').value) {
      $('#movement-ai-status').textContent = 'Você alterou a categoria sugerida pela IA. A correção será registrada.';
    }
  });
  $('#filter-type').addEventListener('change', categoryOptions);
  $('#movement-filters').addEventListener('submit', (event) => {
    event.preventDefault();
    if ($('#filter-from').value && $('#filter-to').value && $('#filter-from').value > $('#filter-to').value) {
      $('#movement-list-error').textContent = 'A data inicial deve ser anterior ou igual à data final.';
      return;
    }
    filters = readFilters(); page = 1; refresh();
  });
  $('#movement-clear-filters').addEventListener('click', () => {
    $('#movement-filters').reset(); categoryOptions(); filters = readFilters(); page = 1; refresh();
  });
  $('#movement-retry').addEventListener('click', refresh);
  $('#movement-prev').addEventListener('click', () => { if (page > 1) { page--; refresh(); } });
  $('#movement-next').addEventListener('click', () => { if (page < totalPages) { page++; refresh(); } });
  $('#movement-rows').addEventListener('click', (event) => {
    const edit = event.target.closest('[data-edit-movement]');
    const remove = event.target.closest('[data-delete-movement]');
    const item = movements.find((entry) => String(entry.id) === (edit?.dataset.editMovement ?? remove?.dataset.deleteMovement));
    if (!item || $('#movement-save').disabled) return;
    if (edit) {
      editing = item;
      $('#movement-type').value = item.tipo; categoryOptions();
      $('#movement-category').value = String(item.categoria_id);
      $('#movement-date').value = item.fecha;
      $('#movement-value').value = item.valor;
      $('#movement-description').value = item.descripcion ?? '';
      aiSuggestion = item.categoria_sugerida_id ? {
        categoria_sugerida_id: item.categoria_sugerida_id,
        confianza_ia: item.confianza_ia,
      } : null;
      $('#movement-ai-status').className = aiSuggestion ? 'ai-success' : '';
      $('#movement-ai-status').textContent = aiSuggestion
        ? `Este lançamento teve sugestão da IA (${Number(item.confianza_ia).toFixed(1)}%).`
        : 'A sugestão é opcional e pode ser alterada antes de salvar.';
      $('#movement-form-title').textContent = 'Editar movimentação';
      $('#movement-save').textContent = 'Salvar alterações';
      $('#movement-cancel').classList.remove('hidden');
      $('#movement-error').textContent = '';
      $('#movement-description').focus();
    } else {
      pendingDelete = item;
      $('#movement-delete-description').textContent = `${item.descripcion} · ${money(item.valor)}`;
      $('#movement-delete-error').textContent = '';
      $('#movement-delete-confirm').disabled = false;
      $('#movement-delete-dialog').showModal();
    }
  });
  $('#movement-delete-confirm').addEventListener('click', async () => {
    if (!pendingDelete || $('#movement-delete-confirm').disabled) return;
    const session = epoch;
    const item = pendingDelete;
    $('#movement-delete-confirm').disabled = true;
    try {
      await api(`/api/movimientos/${item.id}`, { method: 'DELETE' });
      if (session !== epoch) return;
      $('#movement-delete-dialog').close();
      pendingDelete = null;
      if (String(editing?.id) === String(item.id)) resetForm();
      toast('Movimentação excluída.');
      await refresh();
    } catch (error) {
      if (session !== epoch) return;
      if (error.status === 401) { onUnauthorized(); toast('Sua sessão expirou. Entre novamente.'); return; }
      $('#movement-delete-error').textContent = error.message;
    } finally {
      if (session === epoch) $('#movement-delete-confirm').disabled = false;
    }
  });

  return {
    setCategories(items) { categories = items; categoryOptions(); },
    async start() {
      epoch++;
      page = 1;
      $('#movement-filters').reset();
      const now = new Date();
      $('#filter-from').value = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
      $('#filter-to').value = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      filters = readFilters(); resetForm();
      await refresh();
    },
    reset() {
      epoch++; requestVersion++;
      movements = []; categories = []; editing = null; pendingDelete = null;
      $('#movement-rows').replaceChildren();
      $('#movement-results').classList.add('hidden');
      $('#category-chart').replaceChildren();
      $('#period-chart').replaceChildren();
      $('#movement-delete-dialog').close();
      resetForm();
      for (const id of ['total-income', 'total-expense', 'total-balance']) $(`#${id}`).textContent = '—';
    },
  };
}
