# CampoDigital Backend

API inicial do MVP de gestão financeira para produtores rurais.

## Requisitos

- Node.js 22 ou superior
- MySQL 8.0.16 ou superior

## Primeira execução

1. No MySQL Workbench, abra `migrations/000_local_setup.sql`, substitua `change_me` por uma senha local e execute o arquivo como administrador.
2. Copie `.env.example` como `.env` e use em `DB_PASSWORD` a mesma senha da etapa anterior.
3. Instale as dependências com `npm install`.
4. Execute `npm run db:migrate` para criar as tabelas essenciais.
5. Execute `npm run db:check` para confirmar que as tabelas possuem as colunas esperadas.
6. Inicie o servidor com `npm run dev`.

O usuário `campodigital` fica limitado ao banco do projeto. Não utilize a conta `root` para executar normalmente a API.

## Endpoints disponíveis

- `GET /health`: confirma que a API está ativa.
- `GET /health/database`: confirma que o MySQL está respondendo.
- `POST /api/auth/register`: registra um produtor e inicia sua sessão.
- `POST /api/auth/login`: inicia uma sessão.
- `GET /api/auth/me`: devolve o usuário autenticado; exige `Authorization: Bearer <token>`.
- `GET /api/actividades`: lista as atividades produtivas do usuário.
- `POST /api/actividades`: cria uma atividade produtiva.
- `PUT /api/actividades/:id`: atualiza uma atividade do usuário.
- `GET /api/categorias`: lista categorias do sistema e do usuário.
- `POST /api/categorias`: cria uma categoria própria.
- `PATCH /api/categorias/:id/desactivar`: desativa uma categoria própria.
- `GET /api/movimientos/graficos`: agrupa os valores por categoria e por mês.
- `POST /api/ia/sugerir-categoria`: solicita uma categoria ao serviço Python/TensorFlow.
- `GET /api/insights`: consulta o histórico de análises financeiras do produtor.
- `POST /api/insights/analisar`: gera e salva uma análise de um período escolhido.
- `GET /api/insights/preferencias`: consulta as preferências de alertas do produtor.
- `PUT /api/insights/preferencias`: atualiza frequência, ativação e percentual mínimo dos alertas.
- `PATCH /api/insights/:id/avaliacao`: registra se uma análise foi útil ou não.

## Frontend

Com a API iniciada, abra `http://localhost:3000`. A interface utiliza HTML, CSS e JavaScript e permite cadastrar uma conta, iniciar uma sessão e gerenciar atividades produtivas, categorias e movimentações financeiras. Não é necessário iniciar outro servidor para a interface integrada.

Exemplo:

```bash
curl http://localhost:3000/health
curl http://localhost:3000/health/database
```

Cadastro:

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"nombre":"Bruno","email":"bruno@example.com","password":"uma-senha-segura"}'
```

Guarde o `accessToken` da resposta para utilizar as rotas protegidas. A senha é armazenada com `scrypt`, nunca como texto simples.

## Escopo atual

Esta versão contém configuração, servidor Express, pool MySQL, verificações de funcionamento, migração das quatro tabelas essenciais, autenticação por token, perfil produtivo, categorias e frontend responsivo. Também inclui cadastro, edição, exclusão e consulta de movimentações financeiras com totais e gráficos por período.

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

A migração também adapta, sem apagar registros, o esquema produzido na primeira etapa do TCC, no qual as categorias utilizavam os nomes `es_global` e `activo`. Se a interface mostrar “Erro interno do servidor” nas telas de produção, categorias e movimentações, pare o servidor, execute `npm run db:migrate` e depois `npm run db:check`.

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

## Análises e insights financeiros

O menu **Análises** permite escolher um período de até 366 dias. O sistema gera um resumo em linguagem simples, compara receitas, despesas e saldo com o período anterior de mesma duração, calcula o impacto das categorias de despesas e identifica movimentações acima do padrão histórico quando existem dados suficientes. O produtor pode ativar alertas, escolher sua frequência e definir o percentual mínimo de aumento de despesas por categoria.

Cada resultado é salvo em `insights_financieros` com os dados utilizados como referência. O produtor pode consultar o histórico de suas próprias análises e avaliá-las como **Útil** ou **Não útil**. Os resultados são apresentados como apoio à organização financeira e não substituem orientação contábil.

Exemplo:

```json
{
  "inicio": "2026-09-01",
  "fim": "2026-09-30"
}
```

### Validação

```bash
npm run check
npm test
node --test test/movements.test.js
```

A suíte contém 47 testes. Eles exercitam as rotas Express, tokens e serviços reais com repositórios em memória, cobrindo validações, permissões, categorias inativas, filtros, paginação, gráficos, metadados de IA, análises financeiras, alertas, preferências, avaliação dos insights, histórico e continuidade do cadastro manual. **Não executam consultas em um servidor MySQL nem treinam o TensorFlow.**

Para conferir com seu banco local: registre uma receita de R$ 150,50 e uma despesa de R$ 58,25 no mesmo período. O saldo deve ser R$ 92,25. Edite a receita para R$ 200,10 (saldo R$ 141,85), aplique os filtros e exclua a despesa (saldo R$ 200,10). Atualize a página para conferir a persistência e use uma segunda conta para verificar que ela não vê os lançamentos da primeira.

A interface possui estados de carregamento/erro, confirmação antes da exclusão, gráficos financeiros acessíveis, sugestão opcional de categoria e suporte a telas pequenas.
