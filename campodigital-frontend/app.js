import { createFinance } from './finance.js';
import { createInsights } from './insights.js';

const state = {
  mode: 'login',
  token: localStorage.getItem('campodigital_token'),
  user: null,
  activities: [],
  categories: [],
  notifications: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(body.message || 'Não foi possível concluir a operação.'), { status: response.status });
  return body;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('show');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => element.classList.remove('show'), 2800);
}

function setMode(mode) {
  if (state.mode !== mode) {
    $('#auth-form').reset();
    $('#password').type = 'password';
    $('#toggle-password').textContent = 'Mostrar';
    $('#toggle-password').setAttribute('aria-label', 'Mostrar senha');
    $('#toggle-password').setAttribute('aria-pressed', 'false');
  }
  state.mode = mode;
  const isRegister = mode === 'register';
  $('#login-tab').classList.toggle('active', !isRegister);
  $('#register-tab').classList.toggle('active', isRegister);
  $('#login-tab').setAttribute('aria-selected', String(!isRegister));
  $('#register-tab').setAttribute('aria-selected', String(isRegister));
  $('#name-field').classList.toggle('hidden', !isRegister);
  $('#name').required = isRegister;
  $('#password').autocomplete = isRegister ? 'new-password' : 'current-password';
  $('#auth-title').textContent = isRegister ? 'Crie sua conta' : 'Entre na sua conta';
  $('#auth-subtitle').textContent = isRegister ? 'Comece a organizar sua produção.' : 'Acesse seu painel financeiro.';
  $('#submit-auth').textContent = isRegister ? 'Criar conta' : 'Entrar';
  $('#form-error').textContent = '';
}

async function submitAuth(event) {
  event.preventDefault();
  const button = $('#submit-auth');
  const error = $('#form-error');
  error.textContent = '';
  button.disabled = true;

  try {
    const payload = {
      email: $('#email').value,
      password: $('#password').value,
    };
    if (state.mode === 'register') payload.nombre = $('#name').value;

    const result = await api(`/api/auth/${state.mode === 'register' ? 'register' : 'login'}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    state.token = result.accessToken;
    state.user = result.usuario;
    localStorage.setItem('campodigital_token', state.token);
    await enterApp();
    toast(state.mode === 'register' ? 'Conta criada com sucesso.' : 'Acesso realizado com sucesso.');
  } catch (requestError) {
    error.textContent = requestError.message;
  } finally {
    button.disabled = false;
  }
}

async function enterApp() {
  const token = state.token;
  if (!state.user) {
    const result = await api('/api/auth/me');
    if (state.token !== token) return;
    state.user = result.usuario;
  }
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  renderUser();
  const results = await Promise.allSettled([loadActivities(), loadCategories(), loadNotifications()]);
  if (state.token !== token) return;
  const failure = results.find((result) => result.status === 'rejected');
  if (failure) toast(failure.reason.message);
  showSection('dashboard');
  await Promise.all([finance.start(), insights.start()]);
}

function renderUser() {
  $('#user-name').textContent = state.user.nombre;
  $('#user-initial').textContent = state.user.nombre.slice(0, 1).toUpperCase();
  $('#welcome-title').textContent = `Olá, ${state.user.nombre.split(' ')[0]}!`;
  $('#profile-name').value = state.user.nombre;
  $('#profile-email').value = state.user.email;
  $('#profile-phone').value = state.user.telefone ?? '';
  $('#profile-property').value = state.user.nome_propriedade ?? '';
  $('#profile-location').value = state.user.localidade ?? '';
}

async function saveProfile(event) {
  event.preventDefault();
  const token = state.token;
  const button = $('#profile-save');
  const error = $('#profile-error');
  error.textContent = '';
  button.disabled = true;
  try {
    const result = await api('/api/auth/me', {
      method: 'PUT',
      body: JSON.stringify({
        nombre: $('#profile-name').value, email: $('#profile-email').value,
        telefone: $('#profile-phone').value, nome_propriedade: $('#profile-property').value,
        localidade: $('#profile-location').value,
      }),
    });
    if (state.token !== token) return;
    state.user = result.usuario;
    renderUser();
    toast('Perfil atualizado.');
  } catch (requestError) {
    if (state.token !== token) return;
    if (requestError.status === 401) { logout(); toast('Sua sessão expirou. Entre novamente.'); return; }
    error.textContent = requestError.message;
  } finally {
    if (state.token === token) button.disabled = false;
  }
}

function logout() {
  finance.reset();
  insights.reset();
  state.activities = [];
  state.categories = [];
  $('#profile-form').reset();
  $('#profile-error').textContent = '';
  renderActivities();
  renderCategories();
  showSection('dashboard');
  localStorage.removeItem('campodigital_token');
  state.token = null;
  state.user = null;
  $('#app-view').classList.add('hidden');
  $('#auth-view').classList.remove('hidden');
  $('#auth-form').reset();
  setMode('login');
}

function showSection(name) {
  $$('.content-section').forEach((section) => section.classList.add('hidden'));
  $(`#${name}-section`).classList.remove('hidden');
  $$('.nav-item[data-section]').forEach((item) => item.classList.toggle('active', item.dataset.section === name));
  $('.sidebar').classList.remove('open');
}

async function loadActivities() {
  const token = state.token;
  const result = await api('/api/actividades');
  if (state.token !== token) return;
  state.activities = result.actividades;
  renderActivities();
}

function renderActivities() {
  const list = $('#activity-list');
  if (!state.activities.length) {
    list.innerHTML = '<div class="empty-state">Nenhuma atividade cadastrada ainda.</div>';
    return;
  }
  list.innerHTML = state.activities.map((item) => `
    <article class="activity-item">
      <span aria-hidden="true">♧</span>
      <div><strong>${escapeHtml(item.nombre)}</strong><small>${escapeHtml(item.descripcion || 'Sem descrição')} · ${item.activa ? 'Ativa' : 'Inativa'}</small></div>
      <button type="button" data-edit-activity="${item.id}">Editar</button>
    </article>`).join('');
}

async function saveActivity(event) {
  event.preventDefault();
  const id = $('#activity-id').value;
  const error = $('#activity-error');
  error.textContent = '';
  const payload = {
    nombre: $('#activity-name').value,
    descripcion: $('#activity-description').value,
    activa: $('#activity-active').checked,
  };
  try {
    await api(id ? `/api/actividades/${id}` : '/api/actividades', {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(payload),
    });
    $('#activity-form').reset();
    $('#activity-id').value = '';
    $('#activity-active').checked = true;
    $('#activity-active-field').classList.add('hidden');
    await loadActivities();
    toast(id ? 'Atividade atualizada.' : 'Atividade cadastrada.');
  } catch (requestError) {
    error.textContent = requestError.message;
  }
}

function editActivity(id) {
  const item = state.activities.find((activity) => activity.id === Number(id));
  if (!item) return;
  $('#activity-id').value = item.id;
  $('#activity-name').value = item.nombre;
  $('#activity-description').value = item.descripcion || '';
  $('#activity-active').checked = Boolean(item.activa);
  $('#activity-active-field').classList.remove('hidden');
  showSection('production');
  $('#activity-name').focus();
}

async function loadNotifications() {
  const result = await api('/api/insights/notificacoes');
  state.notifications = result.notificacoes || [];
  renderNotifications();
}

function renderNotifications() {
  const count = $('#notifications-count'); const list = $('#dashboard-notification-list'); const alertsList = $('#alerts-list'); const card = $('#dashboard-notifications');
  if (!count || !list || !card) return;
  count.textContent = String(state.notifications.length); count.classList.toggle('hidden', state.notifications.length === 0); card.classList.toggle('hidden', state.notifications.length === 0);
  const html = state.notifications.map((item) => `<article class=\"notification-item\"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.quantidade + ' alerta(s) encontrado(s)')}</small><p>${escapeHtml(item.mensagem || '')}</p></article>`).join('');
  list.innerHTML = state.notifications.slice(0, 3).map((item) => `<p class=\"notification-item\"><strong>${escapeHtml(item.titulo)}</strong><small>${escapeHtml(item.quantidade + ' alerta(s) encontrado(s)')}</small></p>`).join('');
  if (alertsList) alertsList.innerHTML = html || '<p class=\"empty-state\">Nenhum alerta registrado.</p>';
}

function productionDescriptionForSuggestions() {
  const description = $('#category-production-description').value.trim();
  if (description) {
    return { nombre: description, descripcion: description, produtos_trabalhados: description };
  }
  const activities = state.activities.filter((item) => item.activa !== false);
  if (!activities.length) return null;
  return {
    nombre: activities.map((item) => item.nombre).join(' '),
    tipo_producao: activities.map((item) => item.tipo_producao).filter(Boolean).join(' '),
    produtos_trabalhados: activities.map((item) => item.produtos_trabalhados).filter(Boolean).join(' '),
    descripcion: activities.map((item) => item.descripcion).filter(Boolean).join(' '),
  };
}

async function suggestCategoriesForProduction() {
  const status = $('#category-ai-status');
  const button = $('#category-suggest-production');
  const activity = productionDescriptionForSuggestions();
  status.textContent = '';
  if (!activity || ![activity.nombre, activity.tipo_producao, activity.produtos_trabalhados, activity.descripcion].some((value) => String(value || '').trim())) {
    status.textContent = 'Descreva sua produção acima ou cadastre uma atividade no perfil produtivo.';
    return;
  }

  button.disabled = true;
  status.textContent = 'Analisando a descrição da produção…';
  try {
    const result = await api('/api/ia/sugerir-categorias-producao', {
      method: 'POST',
      body: JSON.stringify({ atividade: activity }),
    });
    const categoryKey = (item) => {
      const name = typeof item?.nombre === 'string' ? item.nombre.trim() : '';
      const type = typeof item?.tipo === 'string' ? item.tipo.trim().toUpperCase() : '';
      return name && ['INGRESO', 'GASTO'].includes(type)
        ? `${type}:${name.toLocaleLowerCase('pt-BR')}`
        : null;
    };
    const existing = new Set(state.categories.map(categoryKey).filter(Boolean));
    const suggestions = (Array.isArray(result.categorias) ? result.categorias : []).filter((item) => {
      const key = categoryKey(item);
      return key && !existing.has(key);
    });
    $('#category-suggestion-list').innerHTML = suggestions.map((item) => `
      <label class="suggestion-option">
        <input type="checkbox" value="${escapeHtml(item.nombre)}" data-suggestion-type="${escapeHtml(item.tipo)}" checked>
        <span>${escapeHtml(item.nombre)} <small>${item.tipo === 'GASTO' ? 'Despesa' : 'Receita'}</small></span>
      </label>`).join('');
    $('#category-suggestions-save').classList.toggle('hidden', suggestions.length === 0);
    status.textContent = suggestions.length
      ? (typeof result.mensagem === 'string' && result.mensagem.trim()
        ? result.mensagem
        : 'Revise as sugestões antes de adicioná-las às suas categorias.')
      : 'As sugestões para essa produção já estão cadastradas.';
  } catch (error) {
    status.textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function saveCategorySuggestions() {
  const button = $('#category-suggestions-save');
  const selected = $('#category-suggestion-list input:checked');
  if (!selected.length) return;
  button.disabled = true;
  try {
    for (const option of selected) {
      try {
        await api('/api/categorias', {
          method: 'POST',
          body: JSON.stringify({ nombre: option.value, tipo: option.dataset.suggestionType }),
        });
      } catch (error) {
        if (error.status !== 409) throw error;
      }
    }
    await loadCategories();
    $('#category-suggestion-list').innerHTML = '';
    button.classList.add('hidden');
    $('#category-ai-status').textContent = 'Categorias selecionadas adicionadas ao seu perfil financeiro.';
    toast('Categorias sugeridas adicionadas.');
  } catch (error) {
    $('#category-ai-status').textContent = error.message;
  } finally {
    button.disabled = false;
  }
}

async function loadCategories() {
  const token = state.token;
  const result = await api('/api/categorias?incluir_inativas=true');
  if (state.token !== token) return;
  state.categories = result.categorias.filter((item) => item.activa);
  finance.setCategories(result.categorias);
  renderCategories();
}

function renderCategories() {
  const incomes = state.categories.filter((item) => item.tipo === 'INGRESO');
  const expenses = state.categories.filter((item) => item.tipo === 'GASTO');
  $('#income-count').textContent = incomes.length;
  $('#expense-count').textContent = expenses.length;
  renderCategoryList($('#income-categories'), incomes, 'income');
  renderCategoryList($('#expense-categories'), expenses, 'expense');
}

function renderCategoryList(container, items, className) {
  container.innerHTML = items.length ? items.map((item) => `
    <article class="category-item ${className}">
      <span class="category-dot" aria-hidden="true"></span>
      <strong>${escapeHtml(item.nombre)}</strong>
      <small>${item.origen === 'SISTEMA' ? 'Padrão' : 'Própria'}</small>
      ${item.origen === 'PROPIA' ? `<button type="button" data-delete-category="${item.id}" aria-label="Desativar ${escapeHtml(item.nombre)}">Desativar</button>` : ''}
    </article>`).join('') : '<div class="empty-state">Nenhuma categoria.</div>';
}

async function saveCategory(event) {
  event.preventDefault();
  const error = $('#category-error');
  error.textContent = '';
  try {
    await api('/api/categorias', {
      method: 'POST',
      body: JSON.stringify({ nombre: $('#category-name').value, tipo: $('#category-type').value }),
    });
    $('#category-name').value = '';
    await loadCategories();
    toast('Categoria adicionada.');
  } catch (requestError) {
    error.textContent = requestError.message;
  }
}

async function deactivateCategory(id) {
  try {
    await api(`/api/categorias/${id}/desactivar`, { method: 'PATCH' });
    await loadCategories();
    toast('Categoria desativada.');
  } catch (requestError) {
    toast(requestError.message);
  }
}

function escapeHtml(value) {
  return String(value).replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]);
}

const finance = createFinance({ api, toast, onUnauthorized: logout });
const insights = createInsights({ api, toast, onUnauthorized: logout });

$('#login-tab').addEventListener('click', () => setMode('login'));
$('#register-tab').addEventListener('click', () => setMode('register'));
$('#toggle-password').addEventListener(
  'click',
  togglePasswordVisibility
);
$('#auth-form').addEventListener('submit', submitAuth);
$('#logout').addEventListener('click', logout);
$('#profile-form').addEventListener('submit', saveProfile);
$('#activity-form').addEventListener('submit', saveActivity);
$('#category-form').addEventListener('submit', saveCategory);
$('#category-suggest-production').addEventListener('click', suggestCategoriesForProduction);
$('#category-suggestions-save').addEventListener('click', saveCategorySuggestions);
$('#mobile-menu').addEventListener('click', () => $('.sidebar').classList.toggle('open'));
$$('.nav-item[data-section]').forEach((item) => item.addEventListener('click', () => showSection(item.dataset.section)));
$$('[data-go]').forEach((item) => item.addEventListener('click', () => showSection(item.dataset.go)));
$('#activity-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-edit-activity]');
  if (button) editActivity(button.dataset.editActivity);
});
$('.category-columns').addEventListener('click', (event) => {
  const button = event.target.closest('[data-delete-category]');
  if (button) deactivateCategory(button.dataset.deleteCategory);
});

if (state.token) {
  enterApp().catch(() => logout());
}

function togglePasswordVisibility() {
  const passwordInput = $('#password');
  const toggleButton = $('#toggle-password');
  const isVisible = passwordInput.type === 'text';

  passwordInput.type = isVisible ? 'password' : 'text';
  toggleButton.textContent = isVisible ? 'Mostrar' : 'Ocultar';
  toggleButton.setAttribute(
    'aria-label',
    isVisible ? 'Mostrar senha' : 'Ocultar senha'
  );
  toggleButton.setAttribute('aria-pressed', String(!isVisible));
}


