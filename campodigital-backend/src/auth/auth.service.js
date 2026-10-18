import { hashPassword, verifyPassword } from './password.js';
import { createAccessToken } from './token.js';

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function unauthorized(message = 'Credenciais inválidas.') {
  return Object.assign(new Error(message), { status: 401 });
}

function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function validateRegistration(input) {
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const email = normalizeEmail(input.email);
  const password = typeof input.password === 'string' ? input.password : '';

  if (nombre.length < 2 || nombre.length > 120) {
    throw badRequest('O nome deve ter entre 2 e 120 caracteres.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw badRequest('O e-mail não é válido.');
  }

  if (password.length < 8 || password.length > 128) {
    throw badRequest('A senha deve ter entre 8 e 128 caracteres.');
  }

  return { nombre, email, password };
}

function validateProfile(input, current) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw badRequest('Informe os dados do perfil.');
  }
  const nombre = typeof input.nombre === 'string' ? input.nombre.trim() : '';
  const email = normalizeEmail(input.email);
  if (nombre.length < 2 || nombre.length > 120) {
    throw badRequest('O nome deve ter entre 2 e 120 caracteres.');
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw badRequest('O e-mail não é válido.');
  }
  const optionalText = (key, label, max) => {
    if (input[key] === undefined) return current[key] ?? null;
    if (input[key] === null || input[key] === '') return null;
    if (typeof input[key] !== 'string') throw badRequest(`${label} deve ser texto.`);
    const value = input[key].trim();
    if (!value) return null;
    if (value.length < 2 || value.length > max) {
      throw badRequest(`${label} deve ter entre 2 e ${max} caracteres.`);
    }
    return value;
  };
  const telefone = optionalText('telefone', 'O telefone', 24);
  if (telefone && (!/^\+?[\d() .-]+$/.test(telefone)
    || telefone.replace(/\D/g, '').length < 8 || telefone.replace(/\D/g, '').length > 15)) {
    throw badRequest('Informe um telefone válido com 8 a 15 números.');
  }
  return {
    nombre, email, telefone,
    nome_propriedade: optionalText('nome_propriedade', 'O nome da propriedade', 120),
    localidade: optionalText('localidade', 'A localidade', 120),
  };
}

function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
    telefone: user.telefone ?? null,
    nome_propriedade: user.nome_propriedade ?? null,
    localidade: user.localidade ?? null,
    rol: user.rol,
  };
}

export function createAuthService(repository, tokenOptions) {
  function sessionFor(user) {
    return {
      usuario: publicUser(user),
      accessToken: createAccessToken(user, tokenOptions),
      expiresIn: tokenOptions.ttlSeconds,
    };
  }

  return {
    async register(input = {}) {
      const data = validateRegistration(input);

      if (await repository.findByEmail(data.email)) {
        throw Object.assign(new Error('Já existe um usuário com esse e-mail.'), { status: 409 });
      }

      const passwordHash = await hashPassword(data.password);
      const user = await repository.createUser({ ...data, passwordHash });
      return sessionFor(user);
    },

    async login(input = {}) {
      const email = normalizeEmail(input.email);
      const password = typeof input.password === 'string' ? input.password : '';
      const user = email ? await repository.findByEmail(email) : null;

      if (!user || !user.activo || !(await verifyPassword(password, user.password_hash))) {
        throw unauthorized();
      }

      return sessionFor(user);
    },

    async getUserById(id) {
      const user = await repository.findPublicById(id);

      if (!user || !user.activo) {
        throw unauthorized('A sessão não é mais válida.');
      }

      return publicUser(user);
    },

    async updateProfile(id, input) {
      const current = await repository.findPublicById(id);
      if (!current || !current.activo) throw unauthorized('A sessão não é mais válida.');
      const data = validateProfile(input, current);
      if (data.email !== current.email) {
        const owner = await repository.findByEmail(data.email);
        if (owner && String(owner.id) !== String(id)) {
          throw Object.assign(new Error('Já existe um usuário com esse e-mail.'), { status: 409 });
        }
      }
      try {
        const updated = await repository.updateProfile(id, data);
        if (!updated) throw unauthorized('A sessão não é mais válida.');
        return publicUser(updated);
      } catch (error) {
        if (error.code === 'ER_DUP_ENTRY') {
          throw Object.assign(new Error('Já existe um usuário com esse e-mail.'), { status: 409 });
        }
        throw error;
      }
    },
  };
}
