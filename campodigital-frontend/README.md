# CampoDigital Frontend

Frontend separado do MVP financeiro CampoDigital, desenvolvido com HTML, CSS e JavaScript.

## Requisitos

- Node.js 22 ou superior
- Backend CampoDigital em execução em `http://localhost:3000`

## Como iniciar

Abra um terminal na pasta do backend:

```powershell
npm run dev
```

Abra outro terminal nesta pasta do frontend:

```powershell
npm install
npm run dev
```

Depois, abra `http://localhost:5173`.

O Vite encaminhará automaticamente as solicitações `/api` ao backend em `localhost:3000`. Portanto, não é necessário habilitar CORS durante o desenvolvimento local.

## Arquivos principais

- `index.html`: estrutura das telas.
- `styles.css`: visual responsivo.
- `app.js`: autenticação, navegação e consumo da API.
- `vite.config.js`: servidor local e conexão com o backend.

## Movimentações financeiras

O módulo está disponível no menu Movimentações: cadastro e edição de receitas/despesas, exclusão com confirmação, filtros e paginação. Os mesmos filtros atualizam receitas, despesas e saldo da Visão geral.

O formulário também oferece **Sugerir categoria com IA**. A opção chama o backend, que se comunica com o serviço Python/TensorFlow. A categoria sugerida pode ser alterada pelo produtor, e o cadastro manual permanece funcionando quando a IA está indisponível.

- `finance.js`: comportamento do módulo financeiro, formulários, filtros e totais.
- `insights.js`: geração, apresentação e histórico das análises financeiras.
- `app.js`: autenticação e integração dos módulos.

## Análises financeiras

O menu **Análises** permite selecionar um período, comparar os resultados com o período anterior, visualizar categorias de maior impacto e consultar movimentações acima do padrão histórico. O produtor também configura a frequência e o percentual mínimo dos alertas de despesas e pode avaliar cada resultado como **Útil** ou **Não útil**. As análises geradas ficam disponíveis no histórico do produtor.

A versão integrada em `campodigital-backend/public` também foi atualizada. As duas interfaces utilizam a mesma API. Para trabalhar no frontend separado, edite esta pasta e execute `npm run dev`; `npm run build` verifica e gera a versão de produção.

A API e os critérios de validação estão documentados no [README do backend](../campodigital-backend/README.md#movimentações-financeiras-rf03-a-rf07).
