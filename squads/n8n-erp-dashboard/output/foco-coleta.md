# Planejamento de Coleta de Dados — ERP Dapic
> Gerado em: 2026-05-25 | Aprovado pela usuária: Tania
> Este arquivo é o input oficial para o Artur API (Step 2) e Nelson N8N (Step 3).

---

## 1. Módulos de Dados

### ✅ Módulo 1: Vendas
Combina Pedidos de Venda (B2B/representantes) + Vendas PDV (caixa físico).

**Endpoints:**
- `GET /v1/pedidosvendas` — pedidos de venda do período
- `GET /v1/vendas` — vendas do PDV do período
- `GET /v1/vendas/produtosvendidos` — consolidado de produtos vendidos (evita chamada individual por pedido)

**Detalhamento solicitado:**
- **Evolução diária** — curva de receita dia a dia no período (gráfico de linha)
- **Top produtos** — ranking por receita e por volume, usando `/v1/vendas/produtosvendidos`
- **Por cliente / representante** — receita por cliente e por representante (vem no listing de pedidos)
- **Canal B2B vs PDV** — separar Pedidos (representantes/distribuição) de Vendas PDV (caixa)

**KPIs calculados pelo Dante:**
- Receita Total (Σ ValorLiquido)
- Volume de Vendas (count de registros)
- Ticket Médio (Receita / Volume)
- Variação vs. período anterior (%)
- Top 10 Produtos por receita
- Top 10 Clientes por receita
- Top 5 Representantes por receita
- Receita B2B vs. PDV (split por canal)

---

### ✅ Módulo 2: Estoque — Lógica Completa de Reposição

**Endpoints:**
- `GET /v1/estoques/todos` — posição atual de todos os armazenadores
- `GET /v1/movimentacoesestoque` — histórico de movimentações ⚠️ max 31 dias por request
- `GET /v1/vendas/produtosvendidos` — compartilhado com módulo Vendas (vendas do dia por produto)

**Três análises solicitadas (todas obrigatórias):**

#### Análise 1 — Saldo Disponível do Dia
```
Saldo = Estoque Atual - Vendas do Dia (por produto/SKU)
Alerta 🔴 quando: Saldo < EstoqueMínimo (cadastrado no Dapic)
Alerta 🟡 quando: Saldo < EstoqueMínimo × 1.5 (margem de segurança)
```

#### Análise 2 — Ponto de Reposição (Dias até Zerar)
```
Venda Média Diária = Σ Vendas (últimos 30 dias) / 30 dias
Dias até Zerar = Estoque Atual / Venda Média Diária
Alerta 🔴 quando: Dias até Zerar ≤ 7 dias
Alerta 🟡 quando: Dias até Zerar ≤ 15 dias
Output: lista ordenada por urgência (menos dias primeiro) → "Produzir Agora"
```

#### Análise 3 — Tendência Semanal de Consumo
```
Compara: volume vendido esta semana vs. semana anterior (por produto)
Variação positiva (↑): consumo acelerando → antecipar reposição
Variação negativa (↓): consumo desacelerando → evitar superprodução
```

**KPIs calculados pelo Dante:**
- Valor Total em Estoque (Σ quantidade × preço unitário)
- Número de SKUs com estoque crítico (🔴)
- Número de SKUs em alerta (🟡)
- Lista de produtos para "Produzir Agora" (ordenada por urgência)
- Giro de Estoque = Σ Movimentações (30d) / Estoque Médio (30d)

---

### ✅ Módulo 3: Contas a Pagar

**Endpoint:** `GET /v1/contas/parcelas` (filtrar por tipo = Pagar)
**Endpoint complementar:** `GET /v1/contas/pagamentos`

**Alertas solicitados (todos obrigatórios):**

| Alerta | Lógica | Cor |
|--------|--------|-----|
| Contas vencidas não pagas | DataVencimento < Hoje AND Status ≠ Pago | 🔴 |
| Vencimentos em 7 dias | Hoje ≤ DataVencimento ≤ Hoje+7 | 🟡 |
| Saldo líquido (CP) | Σ Contas a Pagar pendentes | — |
| Fluxo de caixa (saídas) | Projeção semana a semana, próximos 30 dias | — |

**KPIs calculados pelo Dante:**
- Total Pendente a Pagar
- Total Vencido (inadimplência passiva)
- Total vencendo em 7 dias
- Fluxo de saídas por semana (próximas 4 semanas)
- Distribuição por plano de conta (categorias de despesa)

---

### ✅ Módulo 4: Contas a Receber

**Endpoint:** `GET /v1/contas/parcelas` (filtrar por tipo = Receber)
**Endpoint complementar:** `GET /v1/contas/pagamentos`

**Alertas solicitados (todos obrigatórios):**

| Alerta | Lógica | Cor |
|--------|--------|-----|
| Inadimplência | DataVencimento < Hoje AND Status ≠ Recebido | 🔴 |
| Recebimentos em 7 dias | Hoje ≤ DataVencimento ≤ Hoje+7 | 🟡 |
| Saldo líquido | CR - CP (posição financeira líquida) | — |
| Fluxo de caixa (entradas) | Projeção semana a semana, próximos 30 dias | — |

**KPIs calculados pelo Dante:**
- Total Pendente a Receber
- Total em Atraso (inadimplência ativa)
- Total recebendo em 7 dias
- **Saldo Líquido = Total CR - Total CP** (posição financeira do período)
- Fluxo de entradas por semana (próximas 4 semanas)
- **Fluxo de Caixa Consolidado** = Entradas projetadas - Saídas projetadas por semana

---

## 2. Período de Dados

| Contexto | Período | Observações |
|----------|---------|-------------|
| **Dashboard principal** | Mês atual (30 dias) | Filtro padrão ao abrir o dashboard |
| **Histórico expandido** | 90 dias | Disponível via filtro no dashboard |
| **Alertas financeiros** | Próximos 30 dias | Para fluxo de caixa projetado |
| **Movimentações estoque** | 30 dias (3 requests de 31d para 90d) | Limitação da API: max 31 dias/request |

---

## 3. Frequência de Coleta

### Automática — Cron diário às 06:00
```
Cron: 0 6 * * *
Coletar: dados do dia anterior completos + atualizar histórico
```

### Manual — Botão no Dashboard
```
Trigger: Webhook N8N (URL exposta pelo workflow)
Ação: re-execução imediata do workflow de coleta completo
UI: Botão "Atualizar Agora" no header do dashboard
Feedback: spinner + timestamp da última atualização
```

---

## 4. Endpoints Necessários — Mapa Completo

| Módulo | Endpoint | Método | Parâmetros Chave | Paginado? |
|--------|----------|--------|-----------------|-----------|
| Vendas | `/v1/pedidosvendas` | GET | DataInicial, DataFinal, Status=5 | ✅ Max 200/page |
| Vendas | `/v1/vendas` | GET | DataInicial, DataFinal | ✅ Max 200/page |
| Vendas | `/v1/vendas/produtosvendidos` | GET | DataInicial, DataFinal | ✅ Max 200/page |
| Estoque | `/v1/estoques/todos` | GET | — | ✅ Max 200/page |
| Estoque | `/v1/movimentacoesestoque` | GET | DataInicial, DataFinal (max 31d) | ✅ Max 200/page |
| Contas CP | `/v1/contas/parcelas` | GET | DataInicial, DataFinal, tipo=pagar | ✅ Max 200/page |
| Contas CR | `/v1/contas/parcelas` | GET | DataInicial, DataFinal, tipo=receber | ✅ Max 200/page |
| Contas | `/v1/contas/pagamentos` | GET | DataInicial, DataFinal | ✅ Max 200/page |
| Auth | `/autenticacao/v1/login` | POST | Empresa, TokenIntegracao | ❌ |

**Total de endpoints distintos: 8 (+ 1 de auth)**

---

## 5. Schema de Saída — Estrutura de Arquivos

```
/data/erp/
  YYYY-MM-DD/
    vendas.json          → { summary, evolucao_diaria, top_produtos, por_cliente, por_representante, b2b_vs_pdv }
    estoque.json         → { summary, saldo_dia, reposicao_urgente[], tendencia_semanal, giro }
    contas-pagar.json    → { summary, vencidos[], vencendo_7d[], fluxo_semanal[] }
    contas-receber.json  → { summary, inadimplentes[], recebendo_7d[], fluxo_semanal[], saldo_liquido }
    fluxo-caixa.json     → { saldo_liquido, projecao_4_semanas[], consolidado_por_semana[] }
```

---

## 6. Regras de Negócio Específicas

### Estoque
- Produto "crítico" = Dias até Zerar ≤ 7 dias
- Produto "em alerta" = Dias até Zerar ≤ 15 dias
- Venda Média Diária calculada sempre sobre últimos 30 dias (janela fixa)
- Exibir lista "Produzir Agora" ordenada do mais crítico ao menos crítico

### Vendas
- Ticket Médio = Receita Total / Número de Vendas (não por item)
- Variação % = (Período atual - Período anterior) / Período anterior × 100
- Período anterior = mesmo número de dias imediatamente antes do período atual

### Contas
- Saldo Líquido = Σ CR Pendente - Σ CP Pendente
- Fluxo de Caixa: agrupar por semana (Seg a Dom), próximas 4 semanas
- Inadimplência: DataVencimento < hoje E status diferente de "pago/recebido"

---

## 7. Restrições Técnicas a Respeitar

| Restrição | Valor | Impacto no Workflow |
|-----------|-------|---------------------|
| Rate limit | 100 req/min por endpoint | Wait 650ms entre requests de paginação |
| Movimentações estoque | Max 31 dias/request | Para 90 dias: 3 requests paralelos (janelas de 30d) |
| Paginação | Max 200 registros/página | Usar RegistrosPorPagina=200 em todos |
| Token | Válido por 24h | 1 request de auth por execução, reutilizar em todos os nodes |
