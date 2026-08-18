# CampoDigital Backend

API inicial del MVP de gestión financiera para productores rurales.

## Requisitos

- Node.js 22 o superior
- MySQL 8.0.16 o superior

## Primer arranque

1. Copia `.env.example` como `.env` y ajusta las credenciales.
2. Ejecuta `migrations/001_core.sql` en MySQL.
3. Instala las dependencias con `npm install`.
4. Inicia el servidor con `npm run dev`.

## Endpoints disponibles

- `GET /health`: confirma que la API está activa.
- `GET /health/database`: confirma que MySQL responde.

Ejemplo:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/database
```

## Alcance actual

Esta primera versión contiene solamente la base necesaria para comenzar el desarrollo: configuración, servidor Express, pool MySQL, comprobaciones de salud y la migración de las cuatro tablas esenciales. La autenticación, los movimientos y los resúmenes financieros se incorporarán de forma incremental.
