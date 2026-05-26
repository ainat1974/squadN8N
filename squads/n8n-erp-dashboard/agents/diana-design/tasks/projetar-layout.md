---
task: "Projetar Layout do Dashboard"
order: 2
input: |
  - visual_identity: Design system criado na task anterior
  - data_schema: KPIs e dados disponíveis por relatório
output: |
  - layout_spec: Layout detalhado de cada painel do dashboard
---

# Projetar Layout do Dashboard

Projeta o layout completo do dashboard — estrutura de navegação, disposição dos painéis (Vendas, Estoque, CP, CR) e hierarquia de informações em cada tela.

## Process

1. **Projetar estrutura de navegação**: Sidebar ou top navigation, links para cada relatório, indicadores de status
2. **Projetar painel de Resumo (Home)**: KPIs consolidados de todos os relatórios em uma tela só
3. **Projetar painel de Vendas**: Gráficos de receita, volume, ticket médio e top produtos
4. **Projetar painel de Estoque**: Posição atual, alertas de mínimo e máximo, evolução
5. **Projetar painéis CP e CR**: Saldos, vencimentos próximos, distribuição por status

## Output Format

```
# Layout do Dashboard — ERP Dapic

## Estrutura de Navegação
[ASCII mockup da sidebar/topbar]

## Painel: Resumo (Home)
[ASCII mockup do layout com posição dos KPI cards e gráficos]

## Painel: Vendas
[ASCII mockup detalhado]

## Grid System
- 12 colunas, gap 24px
- KPI Card: span 3 cols (4 por linha em desktop)
- Gráfico principal: span 8 cols
- Gráfico secundário: span 4 cols
```

## Output Example

```markdown
# Layout do Dashboard — ERP Dapic

## 🧭 Estrutura de Navegação (Sidebar)
```
┌─────────────────────────────────────────────────────────────┐
│ [🤖] ERP Dashboard              [🔔 Alertas] [👤 Usuário]   │
├──────────┬──────────────────────────────────────────────────┤
│ SIDEBAR  │                   CONTEÚDO                       │
│          │                                                   │
│ 📊 Resumo│                                                   │
│ 💰 Vendas│                                                   │
│ 📦 Estoque                                                   │
│ 💳 C. Pagar                                                  │
│ 💵 C. Receber                                                │
│          │                                                   │
│ ─────    │                                                   │
│ ⚙️ Config │                                                   │
│ 📅 [data]│                                                   │
└──────────┴──────────────────────────────────────────────────┘
Sidebar width: 240px | Conteúdo: flex-1, padding 32px
```

## 🏠 Painel: Resumo (Home)
```
┌─────────────────────────────────────────────────────────────┐
│ Bom dia, Tania 👋    Dados de: 15/01/2024    [Atualizar 🔄] │
├──────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────┐│
│ │ 💰 RECEITA  │ │ 📦 ESTOQUE  │ │ 💳 A PAGAR  │ │💵A RECEB││
│ │ R$ 185.420  │ │  R$ 892.1K  │ │ R$ 45.230   │ │R$ 78.900││
│ │ ▲ +12,5%    │ │  ▼ -3,2%    │ │ ⚠️ 3 vencidos│ │▲ +8,1% ││
│ └─────────────┘ └─────────────┘ └─────────────┘ └─────────┘│
│                                                              │
│ ┌──────────────────────────────┐ ┌──────────────────────────┐│
│ │   Receita dos últimos 30d   │ │   Vencimentos desta semana││
│ │   [GRÁFICO LINHA - 8 cols]  │ │   [GRÁFICO BARRA - 4 cols]││
│ │                              │ │                           ││
│ │                              │ │  CP: R$ 12.400           ││
│ │                              │ │  CR: R$ 28.900           ││
│ └──────────────────────────────┘ └──────────────────────────┘│
└──────────────────────────────────────────────────────────────┘
Grid: 12 colunas | KPI cards: 3 cols cada | Charts: 8+4 cols
```

## 💰 Painel: Vendas
```
┌──────────────────────────────────────────────────────────────┐
│ Vendas                          Período: [7d ▼] [Filtros ▼]  │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐ │
│ │ Total    │ │ Receita  │ │ Ticket   │ │  vs. período ant.│ │
│ │ 247 vend.│ │R$185.420 │ │ R$ 750  │ │    ▲ +12,5%      │ │
│ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘ │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │            Evolução de Receita (linha) — 8 cols         │  │
│ └─────────────────────────────────────────────────────────┘  │
│ ┌──────────────────────┐ ┌────────────────────────────────┐  │
│ │ Top 5 Produtos       │ │ Vendas por Status (donut)      │  │
│ │ (barra horizontal)   │ │                                │  │
│ │ 4 cols               │ │ 4 cols                         │  │
│ └──────────────────────┘ └────────────────────────────────┘  │
│ ┌─────────────────────────────────────────────────────────┐  │
│ │            Tabela: Últimas Vendas (paginada) — 12 cols  │  │
│ │ Data | Pedido | Cliente | Valor | Status                │  │
│ └─────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

## Breakpoints Responsivos
| Breakpoint | Layout | Colunas KPI |
|---|---|---|
| Desktop (≥1280px) | Sidebar fixa + conteúdo | 4 por linha |
| Laptop (≥1024px) | Sidebar fixa + conteúdo compacto | 4 por linha |
| Tablet (≥768px) | Sidebar recolhível + conteúdo | 2 por linha |
| Mobile (<768px) | Drawer navigation | 1 por linha |
```

## Quality Criteria

- [ ] Layout de todos os 5 painéis documentado (Resumo + 4 relatórios)
- [ ] Grid system especificado (colunas, gaps)
- [ ] Estrutura de navegação definida
- [ ] Breakpoints responsivos documentados
- [ ] Posição e tipo de cada gráfico especificado

## Veto Conditions

Rejeitar e refazer se:
1. Algum dos 4 relatórios (Vendas, Estoque, CP, CR) não tem layout projetado
2. Não há especificação de responsividade (apenas desktop)
