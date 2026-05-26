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
