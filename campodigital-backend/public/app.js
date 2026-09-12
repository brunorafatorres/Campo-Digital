const state = {
  mode: 'login',
  token: localStorage.getItem('campodigital_token'),
  user: null,
  activities: [],
  categories: [],
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

async function api(path, options = {}) {
  const headers = { 'content-type': 'application/json', ...(options.headers ?? {}) };
  if (state.token) headers.authorization = `Bearer ${state.token}`;
  const response = await fetch(path, { ...options, headers });
  if (response.status === 204) return null;
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.message || 'Não foi possível concluir a operação.');
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
  if (!state.user) {
    const result = await api('/api/auth/me');
    state.user = result.usuario;
  }
  $('#auth-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  $('#user-name').textContent = state.user.nombre;
  $('#user-initial').textContent = state.user.nombre.slice(0, 1).toUpperCase();
  $('#welcome-title').textContent = `Olá, ${state.user.nombre.split(' ')[0]}!`;
  await Promise.all([loadActivities(), loadCategories()]);
}

function logout() {
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
  const result = await api('/api/actividades');
  state.activities = result.actividades;
  renderActivities();
}

function renderActivities() {
  const list = $('#activity-list');
  $('#step-activity').classList.toggle('done', state.activities.length > 0);
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
  showSection('profile');
  $('#activity-name').focus();
}

async function loadCategories() {
  const result = await api('/api/categorias');
  state.categories = result.categorias;
  renderCategories();
}

function renderCategories() {
  const incomes = state.categories.filter((item) => item.tipo === 'INGRESO');
  const expenses = state.categories.filter((item) => item.tipo === 'GASTO');
  $('#income-count').textContent = incomes.length;
  $('#expense-count').textContent = expenses.length;
  $('#step-category').classList.toggle('done', state.categories.some((item) => item.origen === 'PROPIA'));
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

function togglePasswordVisibility() {
  const passwordInput = $('#password');
  const toggleButton = $('#toggle-password');
  const isVisible = passwordInput.type === 'text';

  passwordInput.type = isVisible ? 'password' : 'text';
  toggleButton.textContent = isVisible ? 'Mostrar' : 'Ocultar';
  toggleButton.setAttribute('aria-label', isVisible ? 'Mostrar senha' : 'Ocultar senha');
  toggleButton.setAttribute('aria-pressed', String(!isVisible));
}

$('#login-tab').addEventListener('click', () => setMode('login'));
$('#register-tab').addEventListener('click', () => setMode('register'));
$('#toggle-password').addEventListener('click', togglePasswordVisibility);
$('#auth-form').addEventListener('submit', submitAuth);
$('#logout').addEventListener('click', logout);
$('#activity-form').addEventListener('submit', saveActivity);
$('#category-form').addEventListener('submit', saveCategory);
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
