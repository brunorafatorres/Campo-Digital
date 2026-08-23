import { hashPassword, verifyPassword } from './password.js';
import { createAccessToken } from './token.js';

function badRequest(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function unauthorized(message = 'Credenciales inválidas.') {
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
    throw badRequest('El nombre debe tener entre 2 y 120 caracteres.');
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw badRequest('El email no es válido.');
  }

  if (password.length < 8 || password.length > 128) {
    throw badRequest('La contraseña debe tener entre 8 y 128 caracteres.');
  }

  return { nombre, email, password };
}

function publicUser(user) {
  return {
    id: user.id,
    nombre: user.nombre,
    email: user.email,
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
        throw Object.assign(new Error('Ya existe un usuario con ese email.'), { status: 409 });
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
        throw unauthorized('La sesión ya no es válida.');
      }

      return publicUser(user);
    },
  };
}
