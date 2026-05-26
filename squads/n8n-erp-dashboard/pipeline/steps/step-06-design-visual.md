---
execution: subagent
agent: diana-design
inputFile: squads/n8n-erp-dashboard/output/data-schema.md
outputFile: squads/n8n-erp-dashboard/output/design-spec.md
model_tier: powerful
---

# Step 06: Design Visual do Dashboard

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/data-schema.md` — Schema de dados, KPIs e endpoints disponíveis
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Framework de design de dashboards

## Instructions

### Process
1. **Analisar KPIs disponíveis**: Quais dados estão disponíveis por relatório para exibir no dashboard
2. **Executar as 3 tasks da Diana Design em sequência**:
   - Task 1: `criar-identidade-visual.md` — paleta de cores, tipografia, tokens CSS
   - Task 2: `projetar-layout.md` — layout de cada painel (Resumo + 4 relatórios)
   - Task 3: `especificar-componentes.md` — KPICard, gráficos Chart.js, tabela, filtros
3. **Garantir WCAG AA**: Verificar contraste de todas as combinações de cor
4. **Especificar responsividade**: Breakpoints para desktop, laptop e tablet
5. **Incluir código CSS e JSX** de cada componente, pronto para o Fábio implementar

## Output Format

```markdown
# Especificação de Design — ERP Dashboard

## Design System
### Paleta de Cores (com tokens CSS)
### Tipografia
### Tokens CSS completos

## Layouts
### Painel: Resumo
### Painel: Vendas
### Painel: Estoque
### Painel: Contas a Pagar
### Painel: Contas a Receber

## Componentes
### KPICard (HTML + CSS)
### Gráficos Chart.js (configuração JavaScript)
### DataTable
### Filtros de Período
### Estados: Loading, Vazio, Erro
```

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. Alguma cor sem contraste WCAG AA verificado
2. Layouts de painéis ausentes (algum dos 4 relatórios sem layout)
3. Código CSS/JSX dos componentes ausente

## Quality Criteria

- [ ] Tokens CSS completos gerados
- [ ] Contraste WCAG AA verificado para todas as cores
- [ ] Layout de todos os 5 painéis documentado
- [ ] Configuração Chart.js para cada tipo de gráfico
- [ ] Breakpoints responsivos definidos
- [ ] Estados de loading, vazio e erro especificados
