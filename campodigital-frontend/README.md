# CampoDigital Frontend

Frontend separado del MVP financiero CampoDigital, desarrollado con HTML, CSS y JavaScript.

## Requisitos

- Node.js 22 o superior
- Backend CampoDigital ejecutándose en `http://localhost:3000`

## Cómo iniciar

Abre una terminal en la carpeta del backend:

```powershell
npm run dev
```

Abre otra terminal en esta carpeta del frontend:

```powershell
npm install
npm run dev
```

Después abre `http://localhost:5173`.

Vite enviará automáticamente las solicitudes `/api` al backend de `localhost:3000`, por lo que no es necesario habilitar CORS durante el desarrollo local.

## Archivos principales

- `index.html`: estructura de las pantallas.
- `styles.css`: diseño responsivo.
- `app.js`: autenticación, navegación y consumo de la API.
- `vite.config.js`: servidor local y conexión con el backend.
