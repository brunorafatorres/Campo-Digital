# Campo-Digital

Sistema web de gestão financeira para produtores rurais, desenvolvido como TCC.

## Funcionalidades atuais

- Cadastro, login e autenticação por token.
- Cadastro e edição de atividades produtivas.
- Categorias financeiras do sistema e do produtor.
- Receitas e despesas: cadastrar, editar, excluir e consultar.
- Filtros por período, tipo e categoria, com paginação.
- Totais de receitas, despesas e saldo no painel.
- Gráficos financeiros por categoria e por mês.
- Sugestão de categoria por um serviço auxiliar em Python e TensorFlow.

## Como executar

Requisitos básicos: Node.js 22 ou superior e MySQL 8.0.16 ou superior. Para utilizar a sugestão de categorias, também é necessário Python com as dependências descritas no [serviço de IA](campodigital-ai/README.md).

Configure o banco e o arquivo `.env` conforme o [guia do backend](campodigital-backend/README.md). Depois, na pasta `campodigital-backend`, execute:

```bash
npm ci
npm run db:migrate
npm run dev
```

Abra `http://localhost:3000` para usar a interface integrada.

Também existe um [frontend separado com Vite](campodigital-frontend/README.md), iniciado em `http://localhost:5173`, que usa a mesma API.

## Testes

Na pasta `campodigital-backend`:

```bash
npm run check
npm test
```

Os testes automatizados usam dados isolados em memória. A configuração e a persistência no MySQL devem ser conferidas no ambiente local conforme o roteiro do backend.

## Próximas etapas

Ampliar os dados de treinamento, utilizar as correções dos produtores e implementar análises e insights financeiros.
