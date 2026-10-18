import { verifyAccessToken } from './token.js';

export function createRequireAuth(tokenOptions) {
  return function requireAuth(request, _response, next) {
    const authorization = request.get('authorization') ?? '';
    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token) {
      return next(Object.assign(new Error('Entre na sua conta para continuar.'), { status: 401 }));
    }

    try {
      request.auth = verifyAccessToken(token, tokenOptions);
      return next();
    } catch (error) {
      return next(Object.assign(error, { status: 401 }));
    }
  };
}
