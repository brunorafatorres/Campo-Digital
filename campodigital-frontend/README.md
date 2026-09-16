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

## Movimentações financeiras

O módulo está disponível no menu Movimentações: cadastro e edição de receitas/despesas, exclusão com confirmação, filtros e paginação. Os mesmos filtros atualizam receitas, despesas e saldo da Visão geral.

- `finance.js`: comportamento do módulo financeiro, formulários, filtros e totais.
- `app.js`: autenticação e integração dos módulos.

A versão integrada em `campodigital-backend/public` também foi atualizada. As duas interfaces utilizam a mesma API. Para trabalhar no frontend separado, edite esta pasta e execute `npm run dev`; `npm run build` verifica e gera a versão de produção.

A API e os critérios de validação estão documentados no [README do backend](../campodigital-backend/README.md#movimentações-financeiras-rf03-a-rf07).
