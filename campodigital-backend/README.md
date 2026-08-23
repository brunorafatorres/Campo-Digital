# CampoDigital Backend

API inicial del MVP de gestión financiera para productores rurales.

## Requisitos

- Node.js 22 o superior
- MySQL 8.0.16 o superior

## Primer arranque

1. En MySQL Workbench, abre `migrations/000_local_setup.sql`, cambia `change_me` por una contraseña local y ejecútalo como administrador.
2. Copia `.env.example` como `.env` y usa en `DB_PASSWORD` la misma contraseña del paso anterior.
3. Instala las dependencias con `npm install`.
4. Ejecuta `npm run db:migrate` para crear las tablas esenciales.
5. Inicia el servidor con `npm run dev`.

El usuario `campodigital` queda limitado a la base del proyecto. No uses la cuenta `root` para ejecutar normalmente la API.

## Endpoints disponibles

- `GET /health`: confirma que la API está activa.
- `GET /health/database`: confirma que MySQL responde.
- `POST /api/auth/register`: registra un productor e inicia su sesión.
- `POST /api/auth/login`: inicia sesión.
- `GET /api/auth/me`: devuelve el usuario autenticado; requiere `Authorization: Bearer <token>`.

Ejemplo:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/database
```

Registro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Bruno","email":"bruno@example.com","password":"una-clave-segura"}'
```

Guarda el `accessToken` de la respuesta para las rutas protegidas. La contraseña se almacena con `scrypt` y nunca en texto plano.

## Alcance actual

Esta versión contiene configuración, servidor Express, pool MySQL, comprobaciones de salud, migración de las cuatro tablas esenciales y autenticación por token. Los movimientos y los resúmenes financieros se incorporarán de forma incremental.
