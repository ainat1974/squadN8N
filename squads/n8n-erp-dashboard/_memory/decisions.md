# Deliberações por página — Dashboard Tech Malhas

> Registro vivo das decisões arquiteturais tomadas página a página.
> Itens marcados como **CHECKPOINT** ficam pendentes de implementação até que
> todas as deliberações de páginas terminem, para serem feitos em conjunto.

---

## Princípios gerais aprovados

- Cada página tem **workflow N8N próprio** e **intervalo próprio** (autônoma).
- **Teto de 3 meses** explícito no seletor (não silencioso).
- **Variação ▲▼** automática vs. período anterior (mesma duração).
- **Estoque sempre como snapshot atual** (Dapic não retém histórico).
- Lib compartilhada `scripts/lib/dapic-blocks.js` é a fonte única de blocos
  (auth, paginação, coletores, transformadores) para evitar divergências.
- Deploy casa por nome exato (`scripts/deploy-n8n-workflow.js`).

---

## Visão Geral (`/visao-geral`)

### Decidido

- Workflow independente `Tech Malhas - Visao Geral`
  (`POST /webhook/coletar-overview`, `GET /webhook/dados-overview`).
- Seletor próprio + teto 3 meses + variação ▲▼ vs. período anterior automático.
- Estoque snapshot, sinalizado na UI.
- **Agente "Diego — Diretor Executivo"** será adicionado (decisão aprovada
  após autonomia da página).
  - Persona: PhD em Gestão / consultor sênior cross-domain.
  - Entrega: resumo executivo + diagnóstico cross-domain +
    Central de Prioridades **priorizada pelo agente** (substitui regras
    determinísticas) + recomendações executivas (alta/média/baixa).
  - Fallback: se o agente falhar/demorar, cai para a versão determinística
    (mantida no workflow como rede de segurança).
- Preview visual (mock) já validado em
  `erp-dashboard/src/pages/OverviewPage.tsx` (flag `PREVIEW_DIEGO`).

### CHECKPOINT (implementar em lote no fim)

- **CK-OV-1 — Botão "Ver detalhe" leva intervalo via URL (opção B).**
  Ao clicar no card, navegar para a página de destino com
  `?dataInicial=YYYY-MM-DD&dataFinal=YYYY-MM-DD`. A página de destino:
  1. Aplica o intervalo no próprio seletor.
  2. Se o snapshot atual da página for de outro intervalo, exibir banner:
     "Dados abaixo referem-se a X. Clique em Atualizar para recolher
     `<intervalo vindo da Visão Geral>`." + botão **Aplicar e atualizar**.
  3. Cada página segue coletando no **seu** workflow (não compartilha snapshot).
  - Implementação prevista: depois de todas as páginas migradas para o modelo
    autônomo, para padronizar a leitura da query em todas de uma vez.

- **CK-OV-2 — Implementar o Diego de verdade no workflow.**
  Atualmente o frontend mostra apenas o mock visual (flag `PREVIEW_DIEGO`).
  Substituir pelos nós reais: `Preparar Prompt Diego` → `OpenAI Diego (gpt-4o)`
  → `Parse Diego` → `Salvar Overview` (com fallback determinístico).

### Pendente de visualização/validação

- Nenhum item neste momento (preview do Diego aprovado visualmente).

---

## Insights IA Financeiro (`/insights-financeiro`) — PILOTO

### Decidido e implementado

- Workflow independente `Tech Malhas - Insights IA Financeiro`
  (`POST /webhook/coletar-financeiro-ia`, `GET /webhook/dados-financeiro-ia`).
- Agente **Fernanda — PhD em Finanças** com:
  - resumo executivo, diagnóstico, metodologia, glossário, indicadores,
    alertas, recomendações com fundamentação,
  - **blocos dinâmicos** priorizados pela própria agente
    (severidade `critico|atencao|ok` + `prioridade`).
- Validado ponta a ponta (deploy + coleta real + parsing).

### Pendente

- Replicar o mesmo padrão para **Insights IA Estoque (Paulo)**
  quando chegarmos nessa deliberação.

---

## Insights IA Estoque (`/insights-estoque`) — PREVIEW VALIDADO

### Decidido (preview visual aprovado)

- Substitui a antiga `/insights` (redirect já ativo).
- Workflow N8N dedicado a criar:
  `Tech Malhas - Insights IA Estoque`
  (`POST /webhook/coletar-estoque-ia`, `GET /webhook/dados-estoque-ia`).
- Agente **Paulo — PhD em PCP e Operações** (mesmo padrão Fernanda):
  resumo + diagnóstico + metodologia + glossário + indicadores + alertas +
  recomendações + **blocos dinâmicos** + tabela específica
  **"Reposição urgente"** (até 30 itens com scroll).
- **Curva ABC** (3 cards de classe A/B/C + tabela detalhada com scroll).
- Paulo precisa coletar **estoque (snapshot)** + **vendas (do intervalo)**
  para calcular giro, cobertura, ruptura e ABC.

### Pendente

- Criar `scripts/build-workflow-insights-estoque.js` espelhando o
  `build-workflow-insights-financeiro.js` (após validar Vendas/Estoque/Financ).
- Desligar flag `PREVIEW_PAULO` quando o workflow estiver pronto.

---

## Insights IA antiga (`/insights`)

### Decidido

- **Removida** — `/insights` agora redireciona para `/insights-estoque`.
- Arquivo `InsightsPage.tsx` fica órfão (sem rota) e será deletado no
  lote final junto com o cleanup geral.

---

## Vendas (`/vendas`) — DELIBERANDO

### Decidido nesta passagem (frontend imediato)

- **KPIs Receita / Volume / Ticket médio**: validados — são recalculados
  no `TRANSFORMAR_VENDAS` sobre todos os `produtosVendidos` coletados no
  intervalo. `detail` de cada card agora explicita "No intervalo".
- **Removido** quadrante "Canal de venda" (Doughnut PDV/B2B) — todas as
  vendas atuais são PDV; o card mostrava sempre 100/0 e não agregava
  decisão.
- **Top 20** produtos mais vendidos (era Top 10) — slice no frontend
  usando `produtos_vendidos` (que já vem completo do workflow).
- **Estoque atual dos Top 20** (era Top 10) — título e empty state
  atualizados para apontar ao CK-VD-1.

### CHECKPOINT (implementar em lote no fim)

- **CK-VD-1 — Coletar estoque dos Top 20 vendidos do intervalo.**
  Hoje o workflow ativo (`v3-range`) não coleta estoque por SKU dos top
  vendidos — só estoque geral. Quando migrarmos a página Vendas para o
  modelo independente, adicionar nó `Coletar Estoque Top 20` que:
  1. Pega os IDs dos 20 produtos mais vendidos do intervalo.
  2. Consulta `/v1/armazenadores/produtos?IdProduto=...` para cada.
  3. Devolve `estoque_top20` (resumo) + `estoque_top20_linhas` (por cor/tam).
  4. Frontend renomeia as referências `estoque_top10*` → `estoque_top20*`.

### A deliberar (próximas passagens)

- Migrar a página Vendas para o **modelo independente** (workflow próprio,
  seletor próprio, snapshot isolado, polling) — igual Visão Geral.
- Decidir se Vendas terá agente IA dedicado ou seguirá determinística.

---

## Estoque (`/estoque`), Financeiro (`/financeiro`)

### A deliberar

- Ainda no modelo antigo (webhook monolítico `/webhook/erp`).
- Cada uma será deliberada individualmente seguindo o padrão:
  1. Deliberar conteúdo e quadrantes da página.
  2. Visualizar (mock/preview) antes de implementar.
  3. Aprovar e construir workflow próprio + frontend autônomo.
  4. Migrar para `MIGRATED_ROUTES` em `Header.tsx`.

---

## Lote final de execução — STATUS

### Implementado (2026-05-29)

1. **CK-OV-2 — Diego (Diretor Executivo) no workflow Visão Geral** ✅
   - Nós `Preparar Prompt Diego` → `OpenAI Diego (gpt-4o)` →
     `Diego Executivo` → `Parse Diego` adicionados depois de
     `Montar Resumo`, ambos com `continueOnFail` (a determinística
     vira fallback se o agente falhar).
   - `Salvar Overview` anexa `staticData.overview.analise` com o
     payload do Diego (resumo, diagnóstico, blocos cross-domain,
     recomendações, próximos passos).
   - Frontend (`OverviewPage`): `PREVIEW_DIEGO=false`, lê
     `d.analise` real; mock mantido como referência (regredível).

2. **CK-OV-1 — Intervalo via URL nos "Ver detalhe"** ✅
   - Helper `withRange(path, di, df)` em `OverviewPage` anexa
     `?dataInicial=...&dataFinal=...` em todos os links de detalhe
     (blocos do Diego, blocos determinísticos e saúde por área).
   - Hook `useApplyRangeFromUrl()` lê a query nas páginas legadas
     (Vendas, Estoque, Financeiro), aplica no `PeriodContext`
     e limpa a URL para não reaplicar em refresh.

3. **CK-VD-1 — Estoque dos Top 20 em Vendas (v3-range)** ✅
   - `TRANSFORMAR_VENDAS` agora gera `top_produtos: produtos.slice(0,20)`.
   - `SALVAR_RELATORIO` cruza `top_produtos` com `estoque.linhas`
     gerando `vendas.estoque_top10` (lista de produtos) e
     `vendas.estoque_top10_linhas` (todas as variações por cor/tam).
   - Frontend (`SalesPage`): `PREVIEW_ESTOQUE_TOP20=false`.

4. **Insights IA Estoque (Paulo PCP)** ✅
   - Workflow dedicado `Tech Malhas - Insights IA Estoque`,
     gerado por `scripts/build-workflow-insights-estoque.js`.
   - Pipeline: Webhook → Definir Período → Autenticar → Preparar
     Contexto → Coletar Vendas → Transformar Vendas → Coletar
     Estoque → Transformar Estoque → **Calcular ABC**
     (determinístico: reposição urgente + curva A/B/C) → Preparar
     Prompt Paulo → OpenAI Paulo (gpt-4o) → Agente → Parse → Salvar.
   - Webhooks: `POST /webhook/coletar-estoque-ia` (disparo) e
     `GET /webhook/dados-estoque-ia` (leitura). 90 dias máx.
   - Frontend: hook `useInsightsEstoque`, página atualizada,
     `PREVIEW_PAULO=false`.

5. **Flags PREVIEW restantes desligadas** ✅
   - `PREVIEW_FINANCEIRO=false` (`FinancialPage`).
   - `PREVIEW_ESTOQUE=false` (`StockPage`).
   - `PREVIEW_TOP_CLIENTES=false` (`OverviewPage`).
   - As páginas continuam funcionais quando a fonte real não trouxer
     o dado: usam EmptyState ou ocultam o quadrante.

6. **Cleanup** ✅
   - `InsightsPage.tsx` deletada em ciclo anterior.
   - Scripts `probe-*.js` movidos para `scripts/_archive/`.

### Validação end-to-end

- Build de produção (`npm run build`): ✓ 108 módulos, 667 kB.
- Lint (`npm run lint --max-warnings 0`): ✓ sem erros nem warnings.
- Smoke test dos webhooks (intervalo 26/05 a 29/05):
  - `dados-estoque-ia`: 4 blocos Paulo, 30 itens em reposição urgente.
  - `dados-overview`: 5 KPIs + Diego com 3 blocos cross-domain.
  - `erp?modulo=vendas`: 20 top_produtos + 715 linhas de estoque
    cruzadas (estoque_top10_linhas).

### Próximos passos (futuro, fora deste lote)

- Migrar `Vendas`, `Estoque`, `Financeiro` para o **modelo
  independente** (workflow próprio + hook `useIndependentColeta`).
  Hoje ainda usam o `v3-range` compartilhado via `/webhook/erp`.
  A funcionalidade está correta, só falta isolar para reduzir
  latência e permitir snapshots diferentes por página.
- Decidir se a página Vendas terá agente IA dedicado (ex.: "Comercial")
  ou se segue determinística.
