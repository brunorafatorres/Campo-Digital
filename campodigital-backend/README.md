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
5. Ejecuta `npm run db:check` para confirmar que las tablas possuem as colunas esperadas.
6. Inicia el servidor con `npm run dev`.

El usuario `campodigital` queda limitado a la base del proyecto. No uses la cuenta `root` para ejecutar normalmente la API.

## Endpoints disponibles

- `GET /health`: confirma que la API está activa.
- `GET /health/database`: confirma que MySQL responde.
- `POST /api/auth/register`: registra un productor e inicia su sesión.
- `POST /api/auth/login`: inicia sesión.
- `GET /api/auth/me`: devuelve el usuario autenticado; requiere `Authorization: Bearer <token>`.
- `GET /api/actividades`: lista las actividades productivas propias.
- `POST /api/actividades`: crea una actividad productiva.
- `PUT /api/actividades/:id`: actualiza una actividad propia.
- `GET /api/categorias`: lista categorías del sistema y propias.
- `POST /api/categorias`: crea una categoría propia.
- `PATCH /api/categorias/:id/desactivar`: desactiva una categoría propia.
- `GET /api/movimientos/graficos`: agrupa os valores por categoria e por mês.
- `POST /api/ia/sugerir-categoria`: solicita uma categoria ao serviço Python/TensorFlow.

## Frontend

Con la API iniciada, abre `http://localhost:3000`. La interfaz utiliza HTML, CSS y JavaScript y ya permite registrarse, iniciar sesión, gestionar actividades productivas, categorías y movimientos financieros. No necesita iniciar otro servidor.

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

Esta versión contiene configuración, servidor Express, pool MySQL, comprobaciones de salud, migración de las cuatro tablas esenciales, autenticación por token, perfil productivo, categorías y un frontend responsivo. También incluye registro, edición, eliminación y consulta de movimientos financieros com totais e gráficos por período.

## Movimentações financeiras (RF03 a RF07)

Todas as rotas abaixo exigem `Authorization: Bearer <token>`. O produtor é identificado pelo token; `usuario_id` enviado no corpo não é usado.

| Método | Rota | Resultado |
|---|---|---|
| GET | `/api/movimientos` | Movimentações, resumo e paginação |
| GET | `/api/movimientos/resumen` | Receitas, despesas, saldo e quantidade |
| GET | `/api/movimientos/graficos` | Totais agrupados por categoria e por mês |
| POST | `/api/movimientos` | Cadastra uma receita ou despesa |
| PUT | `/api/movimientos/:id` | Substitui os campos financeiros de um lançamento próprio |
| DELETE | `/api/movimientos/:id` | Exclui um lançamento próprio e responde com 204 |

Exemplo de corpo para POST e PUT:

```json
{
  "tipo": "INGRESO",
  "categoria_id": 1,
  "descripcion": "Venda de leite",
  "valor": "150.50",
  "fecha": "2026-09-12"
}
```

Use o ID de uma categoria disponível em sua conta; `1` acima é apenas um exemplo.

- Tipos: `INGRESO` (receita) e `GASTO` (despesa).
- Descrição: de 2 a 255 caracteres; data válida em `AAAA-MM-DD`.
- Valor positivo, até 12 dígitos inteiros e duas casas decimais. O corpo aceita ponto ou vírgula decimal, sem separador de milhar. Os valores retornam como strings decimais; o MySQL calcula as somas em DECIMAL.
- Categorias devem ser do sistema ou do próprio produtor e corresponder ao tipo do lançamento.
- Uma categoria inativa pode ser mantida ao editar o lançamento que já a utilizava; não pode ser escolhida para um novo lançamento.
- Edição/exclusão de um ID inexistente ou pertencente a outro produtor responde com 404.

### Filtros e paginação

`GET /api/movimientos?desde=2026-09-01&hasta=2026-09-30&tipo=GASTO&categoria_id=2&pagina=1`

Os filtros são opcionais, combináveis e incluem ambas as datas. Sem período, a API consulta todo o histórico; a interface inicia no mês atual. A listagem traz 20 registros por página, ordenados por data e ID decrescentes. O resumo considera **todos** os registros que correspondem aos filtros, independentemente da página.

`GET /api/categorias?incluir_inativas=true` inclui categorias arquivadas para consultar o histórico; a chamada padrão continua trazendo apenas as ativas.

### Banco de dados

Este módulo usa a tabela `movimientos_financieros` já existente em `migrations/001_core.sql`, com as categorias `es_sistema`/`activa`. Não há nova migração nesta etapa. Em uma instalação nova, execute `npm run db:migrate`; uma base criada com outra versão do SQL deve ser conferida antes de usar o módulo.

A migração também adapta, sem apagar registros, o esquema produzido na primeira etapa do TCC, no qual as categorias utilizavam os nomes `es_global` e `activo`. Se a interface mostrar “Erro interno del servidor” nas telas de produção, categorias e movimentações, pare o servidor, execute `npm run db:migrate` e depois `npm run db:check`.

## Tecnologias definidas no TCC

- Apresentação: HTML, CSS e JavaScript.
- Aplicação: Node.js 22 com Express 5.
- Persistência: MySQL 8.0.16 ou superior, acessado com `mysql2`.
- Inteligência Artificial: serviço auxiliar em Python com TensorFlow.
- Versionamento: Git e GitHub.

O serviço de IA será independente do funcionamento financeiro básico. Se ele estiver indisponível, autenticação, categorias, atividades e movimentações continuarão funcionando.

## Sugestão de categorias com IA (RF10 e RF16)

Prepare o serviço conforme `../campodigital-ai/README.md` e mantenha `python server.py` em execução. No formulário de movimentações, informe o tipo e a descrição e pressione **Sugerir categoria com IA**. A categoria continua editável antes de salvar.

A API registra `categoria_sugerida_id` e `confianza_ia`; assim, a categoria final pode ser comparada com a sugestão para aproveitar correções em uma etapa posterior. Se o serviço estiver desligado ou exceder o tempo limite, a API responde 503 somente para a sugestão e o lançamento manual continua disponível.

### Validação

```bash
npm run check
npm test
node --test test/movements.test.js
```

A suíte contém 36 testes. Eles exercitam as rotas Express, tokens e serviços reais com repositórios em memória, cobrindo validações, permissões, categorias inativas, filtros, paginação, gráficos, metadados de IA e continuidade do cadastro manual. **Não executam consultas em um servidor MySQL nem treinam o TensorFlow.**

Para conferir com seu banco local: registre uma receita de R$ 150,50 e uma despesa de R$ 58,25 no mesmo período. O saldo deve ser R$ 92,25. Edite a receita para R$ 200,10 (saldo R$ 141,85), aplique os filtros e exclua a despesa (saldo R$ 200,10). Atualize a página para conferir a persistência e use uma segunda conta para verificar que ela não vê os lançamentos da primeira.

A interface possui estados de carregamento/erro, confirmação antes da exclusão, gráficos financeiros acessíveis, sugestão opcional de categoria e suporte a telas pequenas.
