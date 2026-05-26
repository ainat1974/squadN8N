# Dashboard Brief — Tech Malhas ERP
> Aprovado por: Tania | Data: 2026-05-25
> Input para Diana Design (Step 7) e Fábio Frontend (Step 9)

---

## 1. Stack Técnica

| Camada | Tecnologia |
|--------|-----------|
| Framework | React 18.x |
| Bundler | Vite 5.x |
| Estilização | Tailwind CSS 3.x |
| Gráficos | Chart.js 4.x + react-chartjs-2 5.x |
| Roteamento | React Router 6.x |
| Autenticação | Google OAuth 2.0 (via biblioteca `@react-oauth/google`) |
| Backend API | Express 4.x + Node.js 22.x LTS |
| Deploy | Vercel (frontend) + VPS Hostinger (backend + N8N) |

---

## 2. Identidade Visual

### Tema: Dark Mode Profissional

```css
/* Paleta principal */
--bg-base:     #0f172a;  /* slate-900  — fundo principal */
--bg-card:     #1e293b;  /* slate-800  — cards e painéis */
--bg-elevated: #334155;  /* slate-700  — hover, dropdowns */
--border:      #475569;  /* slate-600  — bordas sutis */

/* Acentos e status */
--accent:      #38bdf8;  /* sky-400    — destaque primário, links */
--success:     #22c55e;  /* green-500  — positivo, lucro, ok */
--warning:     #f59e0b;  /* amber-500  — alerta, atenção */
--danger:      #ef4444;  /* red-500    — crítico, vencido */

/* Texto */
--text-primary:   #f1f5f9;  /* slate-100 — texto principal */
--text-secondary: #94a3b8;  /* slate-400 — texto secundário */
--text-muted:     #64748b;  /* slate-500 — labels, placeholders */
```

### Tipografia
- Família: **Inter** (Google Fonts)
- Números grandes (KPIs): peso 700, size 2xl-4xl
- Labels: peso 500, size sm, texto secundário
- Formatação pt-BR: `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`

---

## 3. Estrutura de Páginas — Multi-páginas com Sidebar

```
┌─────────┬──────────────────────────────────────────────────┐
│         │  HEADER: Logo | Filtro Período | Última Atualiz. │
│  LOGO   │           [Atualizar Agora 🔄]                   │
│         ├──────────────────────────────────────────────────┤
│ 📊      │                                                  │
│ Visão   │   CONTEÚDO PRINCIPAL DA PÁGINA                  │
│ Geral   │                                                  │
│         │                                                  │
│ 📈      │                                                  │
│ Vendas  │                                                  │
│         │                                                  │
│ 📦      │                                                  │
│ Estoque │                                                  │
│         │                                                  │
│ 💰      │                                                  │
│Financ.  │                                                  │
│         │                                                  │
│ ─────── │                                                  │
│ 👤 Sair │                                                  │
└─────────┴──────────────────────────────────────────────────┘
```

### Rotas
| Rota | Página | Componente |
|------|--------|------------|
| `/` | Redireciona para `/visao-geral` | — |
| `/login` | Tela de login Google | `LoginPage` |
| `/visao-geral` | Visão Geral Executiva | `OverviewPage` |
| `/vendas` | Análise de Vendas | `SalesPage` |
| `/estoque` | Gestão de Estoque | `StockPage` |
| `/financeiro` | Contas a Pagar e Receber | `FinancialPage` |

---

## 4. Autenticação — Google OAuth

**Biblioteca:** `@react-oauth/google`

**Fluxo:**
1. Rota `/login` → botão "Entrar com Google"
2. OAuth flow → callback → validar email autorizado
3. Emails autorizados configurados via `VITE_ALLOWED_EMAILS` no `.env`
4. Token salvo em `sessionStorage` (não persistir entre sessões por segurança)
5. Todas as rotas protegidas por `<PrivateRoute>` que verifica o token

**Variáveis de ambiente necessárias:**
```env
VITE_GOOGLE_CLIENT_ID=seu-client-id.apps.googleusercontent.com
VITE_ALLOWED_EMAILS=tania@techmalhas.com,outro@empresa.com
```

---

## 5. Header Global

Presente em todas as páginas autenticadas.

**Componentes:**
- 🏷️ Logo / Nome: "Tech Malhas — Dashboard"
- 📅 Filtro de período: dropdown `[Mês atual ▾]` → opções: 7d | 30d | 90d | Personalizado
- 🕐 Última atualização: "Atualizado hoje às 06:04"
- 🔄 Botão "Atualizar Agora" → dispara webhook N8N → mostra spinner até concluir
- 👤 Avatar do usuário Google + botão sair

---

## 6. Página: Visão Geral Executiva (`/visao-geral`)

### KPI Cards — Linha 1 (4 cards em destaque, topo da página)

| Card | Métrica | Cor do destaque |
|------|---------|----------------|
| 💰 Receita do Mês | R$ X.XXX,XX com `+X%` vs. mês anterior | Verde se positivo, vermelho se negativo |
| 📊 Saldo Líquido | CR − CP = R$ X.XXX,XX | Verde se positivo, vermelho se negativo |
| 📦 Estoque Crítico | X SKUs precisam reposição | Vermelho se > 0, verde se = 0 |
| ⚠️ Inadimplência | R$ X.XXX,XX em atraso | Vermelho proporcional ao valor |

### Seção 2 — Gráficos de tendência (2 colunas)
- **Esquerda:** Evolução de receita (últimos 30 dias) — gráfico de linha com gradiente
- **Direita:** Fluxo de caixa projetado — gráfico de barras empilhadas (entradas vs. saídas, próximas 4 semanas)

### Seção 3 — Alertas rápidos (lista)
- Lista de top 5 SKUs mais críticos para reposição (dias até zerar)
- Lista de top 5 contas vencendo nos próximos 7 dias (CP + CR)

---

## 7. Página: Vendas (`/vendas`)

### Seção 1 — KPIs
- Receita Total | Nº de Vendas | Ticket Médio | Variação %

### Seção 2 — Gráfico principal
- Evolução diária de receita (gráfico de linha, período selecionado)
- Toggle: Pedidos B2B vs. Vendas PDV (linhas separadas no mesmo gráfico)

### Seção 3 — Rankings (2 colunas)
- **Esquerda:** Top 10 Produtos por receita (barras horizontais)
- **Direita:** Top 10 Clientes por receita (barras horizontais)

### Seção 4 — Tabela de representantes
- Tabela ordenável: Representante | Nº Pedidos | Receita | Ticket Médio | % do Total

---

## 8. Página: Estoque (`/estoque`)

### Seção 1 — KPIs
- Valor Total em Estoque | Nº SKUs Críticos 🔴 | Nº SKUs em Alerta 🟡 | Giro de Estoque

### Seção 2 — Lista "Produzir Agora" (prioridade)
Tabela ordenada por urgência (menos dias primeiro):

| Produto | Estoque Atual | Venda Média/dia | Dias até Zerar | Urgência |
|---------|--------------|-----------------|----------------|---------|
| Camiseta P Branca | 12 | 4.2 | **2 dias** | 🔴 CRÍTICO |
| Bermuda M Preta | 34 | 3.1 | **10 dias** | 🟡 ALERTA |

### Seção 3 — Análise de Tendência Semanal
- Gráfico de barras: consumo esta semana vs. semana anterior (top 10 produtos)
- Indicador de tendência: ↑ acelerando, ↓ desacelerando

### Seção 4 — Saldo do Dia
- Cards por armazenador/almoxarifado com % de ocupação

---

## 9. Página: Financeiro (`/financeiro`)

### Seção 1 — KPIs lado a lado
| | Contas a Pagar | Contas a Receber |
|---|---|---|
| Total Pendente | R$ X.XXX | R$ X.XXX |
| Em Atraso 🔴 | R$ X.XXX | R$ X.XXX |
| Vencendo em 7d 🟡 | R$ X.XXX | R$ X.XXX |
| **Saldo Líquido** | **CR − CP = R$ X.XXX** | verde/vermelho |

### Seção 2 — Fluxo de Caixa (gráfico central)
- Gráfico de barras empilhadas: entradas (verde) vs. saídas (vermelho) por semana
- Próximas 4 semanas + saldo acumulado (linha sobreposta)

### Seção 3 — Tabelas de alertas (2 colunas)
- **Esquerda:** Contas Vencidas (CP) — ordenadas por valor desc.
- **Direita:** Clientes Inadimplentes (CR) — ordenados por valor desc.

### Seção 4 — Vencimentos próximos (timeline)
- Lista dos próximos 7 dias com filtro CP/CR

---

## 10. Componentes Compartilhados

| Componente | Descrição |
|-----------|-----------|
| `KPICard` | Card com valor grande, label, variação % e cor de status |
| `LineChart` | Gráfico de linha Chart.js com gradiente e tooltip pt-BR |
| `BarChart` | Barras verticais/horizontais com cores semânticas |
| `StackedBarChart` | Barras empilhadas para fluxo de caixa |
| `DataTable` | Tabela ordenável com paginação, busca e export CSV |
| `AlertBadge` | Badge colorido: 🔴 Crítico / 🟡 Alerta / ✅ OK |
| `PeriodSelector` | Dropdown de período (7d/30d/90d/custom) no header |
| `RefreshButton` | Botão com spinner que dispara webhook N8N |
| `PrivateRoute` | HOC que protege rotas com verificação de auth Google |
| `LoadingSkeleton` | Placeholder animado enquanto dados carregam |
| `EmptyState` | Estado vazio quando não há dados no período |

---

## 11. Deploy na Vercel

### Estrutura do projeto para deploy
```
/dashboard          ← Frontend React (deploy na Vercel)
  /src
  package.json
  vite.config.ts
  vercel.json       ← configuração de rotas SPA

/api                ← Backend Express (VPS Hostinger ou Vercel Serverless)
  /routes
  /data             ← JSONs gerados pelo N8N
  server.js
```

### `vercel.json` (SPA routing)
```json
{
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

### Variáveis de ambiente na Vercel
```
VITE_GOOGLE_CLIENT_ID     = (Google OAuth Client ID)
VITE_ALLOWED_EMAILS       = tania@techmalhas.com
VITE_API_URL              = https://api.techmalhas.workflows.tmrodrigues.tech
VITE_N8N_WEBHOOK_URL      = https://workflows.tmrodrigues.tech/webhook/atualizar
```

---

## 12. Responsividade

| Breakpoint | Layout |
|-----------|--------|
| Mobile (<768px) | Sidebar colapsada em menu hamburguer, KPI cards em coluna |
| Tablet (768-1024px) | Sidebar compacta (só ícones), KPI cards em 2 colunas |
| Desktop (>1024px) | Sidebar expandida com labels, 4 KPI cards em linha |
