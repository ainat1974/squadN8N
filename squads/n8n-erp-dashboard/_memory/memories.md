# Squad Memory: N8N ERP Dashboard Squad

## Estilo de Escrita

## Design Visual

## Estrutura de Conteúdo

## Proibições Explícitas

## Técnico (específico do squad)

- 2026-05-26: Step 04 finalizado com `workflow-n8n-otimizado.json`. Otimizacao preserva fan-out paralelo para Vendas, Estoque, Contas a Pagar e Contas a Receber, usa `RegistrosPorPagina=200`, adiciona retry com backoff exponencial (1s, 2s, 4s) para 429/5xx e renovacao de token em 401.
- 2026-05-26: Auditoria local do workflow validou JSON parseavel, 19 nodes, 9 Code nodes com JavaScript valido, 4 nodes de coleta com backoff/paginacao/refresh token e notificacoes com `continueOnFail`.
- 2026-05-26: Auditoria do dashboard local passou em `npm run build`, `npm run lint` e renderizacao Playwright. A tela interna `/visao-geral` renderiza sem page errors; chamadas remotas ao N8N podem retornar `Failed to fetch` em ambiente local sem rede, e a UI mostra o estado de erro esperado.
- 2026-05-26: Corrigido seletor 7d/30d/90d do dashboard. Frontend agora envia `periodo`/`dias` ao webhook, recalcula KPIs de vendas pela serie `evolucao_diaria` e teste Playwright confirmou Receita do Periodo mudando entre 7d, 30d e 90d. Workflow otimizado passou a coletar Vendas com janela de 90 dias para alimentar o filtro.
- 2026-05-26: Workflow N8N atualizado na instancia `workflows.tmrodrigues.tech` com 22 nodes, ativo, incluindo `GET /webhook/erp` com CORS e armazenamento em N8N Static Data. Deploy Vercel publicado em `https://erp-dashboard-one-tan.vercel.app`. Regressao de auth corrigida restaurando o TokenIntegracao validado pela execucao 706 e base Dapic `api.dapic.com.br`; execucao 792 concluiu com sucesso e dashboard exibiu receita real de R$ 1.307.485,79 sem erros JS/CORS.
- 2026-05-26: Arquitetura de coleta reestruturada para D-1 diario. O workflow agora calcula `dataColeta` no fuso `America/Sao_Paulo` e coleta relatorios Dapic apenas do dia anterior (`DataInicial = DataFinal = dataColeta`) para Vendas, Movimentacoes de Estoque, Contas a Pagar e Contas a Receber. A API `/webhook/erp` agrega vendas a partir de `staticData.erp.historico.diario` para suportar 7d/30d/90d sem consultar janelas longas na Dapic. Execucao N8N 839 validada com sucesso: em 2026-05-26 gravou dados de 2026-05-25; dashboard em producao exibiu R$ 75.158,95 e 514 vendas sem erros.
- 2026-05-26: Dashboard redesenhado como command center escuro inspirado na referencia visual da usuaria. A UI agora usa acento laranja, cards densos, paineis com bordas sutis, header com base D-1 real e filtros `D-1/7d/30d/90d`. Frontend passou a tratar `{ success:false }` do N8N como erro real e diferencia erro, modulo sem coleta e coleta vazia. Producao Vercel validada em desktop/mobile sem erros, exibindo D-1 de 2026-05-25 e receita de R$ 75.158,95.
