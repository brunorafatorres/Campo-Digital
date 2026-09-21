export function createInsights({ api, toast, onUnauthorized }) {
  const $ = (selector) => document.querySelector(selector);
  const escape = (value) => String(value ?? '').replace(/[&<>"']/g,
    (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const money = (value) => new Intl.NumberFormat('pt-BR', {
    style: 'currency', currency: 'BRL',
  }).format(Number(value));
  const date = (value) => value ? value.split('-').reverse().join('/') : '';
  const localDate = (value) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
  let history = [];
  let epoch = 0;
  let currentInsightId = null;

  function comparison(item) {
    if (!item || item.direcao === 'SEM_BASE') return 'Sem base anterior para comparação';
    if (item.direcao === 'ESTAVEL') return 'Estável em relação ao período anterior';
    const signal = item.direcao === 'AUMENTO' ? '↑' : '↓';
    const label = item.direcao === 'AUMENTO' ? 'aumento' : 'redução';
    return `${signal} ${Math.abs(Number(item.percentual)).toFixed(1)}% de ${label}`;
  }

  function render(insight) {
    if (!insight) {
      currentInsightId = null;
      $('#insight-result').classList.add('hidden');
      return;
    }
    const data = insight.dados_referencia ?? {};
    const current = data.periodo_atual ?? {};
    const previous = data.periodo_anterior ?? {};
    const comparisons = data.comparacoes ?? {};
    const categories = data.categorias_despesas ?? [];
    const unusual = data.movimentacoes_atipicas ?? [];
    const alerts = data.alertas_despesas ?? [];
    currentInsightId = insight.id;

    $('#insight-result').classList.remove('hidden');
    $('#insight-title').textContent = insight.titulo;
    $('#insight-message').textContent = insight.mensagem;
    $('#insight-periods').textContent = `Comparação: ${date(current.inicio)} a ${date(current.fim)} com ${date(previous.inicio)} a ${date(previous.fim)}`;
    $('#insight-summary').innerHTML = [
      ['Receitas', current.receitas, 'income'],
      ['Despesas', current.despesas, 'expense'],
      ['Saldo', current.saldo, Number(current.saldo) < 0 ? 'expense' : 'balance'],
    ].map(([label, value, style]) => `<article class="insight-metric ${style}">
      <span>${label}</span><strong>${escape(money(value ?? 0))}</strong>
    </article>`).join('');

    $('#insight-comparisons').innerHTML = [
      ['Receitas', comparisons.receitas],
      ['Despesas', comparisons.despesas],
      ['Saldo', comparisons.saldo],
    ].map(([label, value]) => `<li><strong>${label}</strong><span>${escape(comparison(value))}</span></li>`).join('');

    $('#insight-categories').innerHTML = categories.length
      ? categories.slice(0, 5).map((item) => `<li>
          <div><strong>${escape(item.categoria)}</strong><small>${item.quantidade} lançamento(s)</small></div>
          <span>${escape(money(item.total))} · ${Number(item.percentual).toFixed(1)}%</span>
        </li>`).join('')
      : '<li class="insight-empty">Nenhuma despesa registrada no período.</li>';

    $('#insight-anomalies').innerHTML = unusual.length
      ? unusual.map((item) => `<li>
          <div><strong>${escape(item.descricao)}</strong><small>${escape(item.categoria)} · ${date(item.data)}</small></div>
          <span>${escape(money(item.valor))}</span>
        </li>`).join('')
      : '<li class="insight-empty">Nenhuma movimentação atípica foi identificada com os dados disponíveis.</li>';
    $('#insight-alerts').innerHTML = alerts.length
      ? alerts.map((item) => `<li>
          <div><strong>${escape(item.categoria)}</strong><small>Limite configurado: ${Number(item.percentual_configurado).toFixed(1)}%</small></div>
          <span>↑ ${Number(item.percentual_aumento).toFixed(1)}% · ${escape(money(item.total_anterior))} para ${escape(money(item.total_atual))}</span>
        </li>`).join('')
      : '<li class="insight-empty">Nenhum aumento ultrapassou o percentual configurado.</li>';
    document.querySelectorAll('[data-insight-rating]').forEach((button) => {
      const value = button.dataset.insightRating === 'true';
      button.classList.toggle('active', insight.foi_util === value);
      button.setAttribute('aria-pressed', String(insight.foi_util === value));
    });
    $('#insight-warning').textContent = data.aviso ?? 'Análise automática. Não substitui orientação contábil.';
  }

  function renderHistory() {
    $('#insight-history-empty').classList.toggle('hidden', history.length > 0);
    $('#insight-history').innerHTML = history.map((item) => `<button type="button" data-insight-id="${escape(item.id)}">
      <span><strong>${escape(item.titulo)}</strong><small>${date(item.periodo_inicio)} a ${date(item.periodo_fim)}</small></span>
      <span aria-hidden="true">›</span>
    </button>`).join('');
  }

  async function loadHistory() {
    const session = epoch;
    const result = await api('/api/insights');
    if (session !== epoch) return;
    history = result.insights;
    renderHistory();
  }

  async function loadPreferences() {
    const session = epoch;
    const result = await api('/api/insights/preferencias');
    if (session !== epoch) return;
    $('#alerts-active').checked = result.preferencias.alertas_ativas;
    $('#alerts-frequency').value = result.preferencias.frequencia;
    $('#alerts-percentage').value = result.preferencias.percentual_variacao;
  }

  $('#alert-preferences-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = epoch;
    const button = $('#alerts-save');
    const error = $('#alerts-error');
    error.textContent = '';
    button.disabled = true;
    try {
      await api('/api/insights/preferencias', {
        method: 'PUT',
        body: JSON.stringify({
          alertas_ativas: $('#alerts-active').checked,
          frequencia: $('#alerts-frequency').value,
          percentual_variacao: Number($('#alerts-percentage').value),
        }),
      });
      if (session !== epoch) return;
      toast('Preferências de alertas salvas.');
    } catch (requestError) {
      if (session !== epoch) return;
      if (requestError.status === 401) onUnauthorized();
      else error.textContent = requestError.message;
    } finally {
      if (session === epoch) button.disabled = false;
    }
  });

  $('#insight-form').addEventListener('submit', async (event) => {
    event.preventDefault();
    const session = epoch;
    const button = $('#insight-generate');
    const error = $('#insight-error');
    error.textContent = '';
    button.disabled = true;
    button.textContent = 'Analisando…';
    try {
      const result = await api('/api/insights/analisar', {
        method: 'POST',
        body: JSON.stringify({
          inicio: $('#insight-start').value,
          fim: $('#insight-end').value,
        }),
      });
      if (session !== epoch) return;
      render(result.insight);
      await loadHistory();
      toast('Análise financeira gerada.');
    } catch (requestError) {
      if (session !== epoch) return;
      if (requestError.status === 401) {
        onUnauthorized();
        toast('Sua sessão expirou. Entre novamente.');
        return;
      }
      error.textContent = requestError.message;
    } finally {
      if (session === epoch) {
        button.disabled = false;
        button.textContent = 'Gerar análise';
      }
    }
  });

  $('#insight-history').addEventListener('click', (event) => {
    const button = event.target.closest('[data-insight-id]');
    if (!button) return;
    render(history.find((item) => String(item.id) === button.dataset.insightId));
    $('#insight-result').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('#insight-result').addEventListener('click', async (event) => {
    const button = event.target.closest('[data-insight-rating]');
    if (!button || !currentInsightId) return;
    const session = epoch;
    try {
      const result = await api(`/api/insights/${currentInsightId}/avaliacao`, {
        method: 'PATCH',
        body: JSON.stringify({ util: button.dataset.insightRating === 'true' }),
      });
      if (session !== epoch) return;
      const index = history.findIndex((item) => String(item.id) === String(currentInsightId));
      if (index >= 0) history[index] = result.insight;
      render(result.insight);
      toast('Obrigado pela avaliação.');
    } catch (requestError) {
      if (requestError.status === 401) onUnauthorized();
      else toast(requestError.message);
    }
  });

  return {
    async start() {
      epoch++;
      const now = new Date();
      $('#insight-start').value = localDate(new Date(now.getFullYear(), now.getMonth(), 1));
      $('#insight-end').value = localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
      $('#insight-error').textContent = '';
      try {
        await Promise.all([loadHistory(), loadPreferences()]);
        if (history[0]) render(history[0]);
      } catch (error) {
        if (error.status === 401) onUnauthorized();
        else $('#insight-error').textContent = error.message;
      }
    },
    reset() {
      epoch++;
      history = [];
      currentInsightId = null;
      renderHistory();
      render(null);
      $('#insight-form').reset();
      $('#insight-error').textContent = '';
      $('#alerts-error').textContent = '';
    },
  };
}
