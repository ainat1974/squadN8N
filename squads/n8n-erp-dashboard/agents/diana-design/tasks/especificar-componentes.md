---
task: "Especificar Componentes Visuais"
order: 3
input: |
  - layout_spec: Layout projetado na task anterior
  - visual_identity: Design system com tokens CSS
output: |
  - design_spec: Especificação completa de todos os componentes para o Fábio Frontend
---

# Especificar Componentes Visuais do Dashboard

Documenta a especificação técnica de cada componente do dashboard — KPI cards, gráficos, tabelas, filtros — com propriedades visuais exatas para implementação.

## Process

1. **Especificar KPI Card**: Props, estados (loading, vazio, erro), variações (positivo/negativo/neutro)
2. **Especificar tipos de gráfico**: Configuração de Chart.js para cada tipo usado (linha, barra, donut, barra horizontal)
3. **Especificar Tabela de Dados**: Colunas, formatação, paginação, ordenação
4. **Especificar Filtros**: Seletor de período, dropdowns, date picker
5. **Especificar estados**: Loading (skeleton), vazio (empty state), erro (error state)

## Output Format

```markdown
# Especificação de Componentes — ERP Dashboard

## Componente: KPICard
### Props
- title: string
- value: string | number
- trend: number (percentual de variação)
- trendDirection: 'up' | 'down' | 'neutral'
- icon: string (emoji ou nome de ícone)
- loading: boolean

### Variações Visuais
- trend > 0: texto verde (#059669) + ícone ▲
- trend < 0: texto vermelho (#DC2626) + ícone ▼
- trend = 0: texto cinza + ícone →

### CSS
```css
.kpi-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-6);
  box-shadow: var(--shadow-card);
}
```

## Biblioteca de Gráficos: Chart.js v4.x (LTS)
```

## Output Example

```markdown
# Especificação Completa de Componentes — ERP Dashboard

## 📦 KPICard

### Estrutura HTML/JSX
```jsx
<div className="kpi-card">
  <div className="kpi-header">
    <span className="kpi-icon">{icon}</span>
    <span className="kpi-title">{title}</span>
  </div>
  <div className="kpi-value">{formattedValue}</div>
  <div className={`kpi-trend kpi-trend--${trendDirection}`}>
    {trendIcon} {Math.abs(trend)}% vs. ontem
  </div>
</div>
```

### CSS do KPICard
```css
.kpi-card {
  background: var(--color-bg-card);
  border-radius: var(--radius-md);
  padding: var(--space-6); /* 24px */
  box-shadow: var(--shadow-card);
  transition: box-shadow 0.2s ease;
}
.kpi-card:hover { box-shadow: var(--shadow-hover); }
.kpi-title { font-size: 12px; font-weight: 500; color: var(--color-text-secondary); text-transform: uppercase; letter-spacing: 0.05em; }
.kpi-value { font-size: 32px; font-weight: 700; font-family: var(--font-mono); color: var(--color-text-primary); margin: 8px 0; }
.kpi-trend--up   { color: var(--color-success); }
.kpi-trend--down { color: var(--color-danger);  }
.kpi-trend--neutral { color: var(--color-text-secondary); }
```

### Estado Loading (Skeleton)
```jsx
<div className="kpi-card kpi-card--loading">
  <div className="skeleton skeleton--sm"></div>  {/* title */}
  <div className="skeleton skeleton--lg"></div>  {/* value */}
  <div className="skeleton skeleton--sm"></div>  {/* trend */}
</div>
```

## 📈 Gráfico de Linha (Receita Temporal)
### Biblioteca: Chart.js v4.4.x (LTS estável)
```javascript
const lineConfig = {
  type: 'line',
  data: {
    labels: dates,
    datasets: [{
      label: 'Receita',
      data: values,
      borderColor: '#1E40AF',
      backgroundColor: 'rgba(30, 64, 175, 0.1)',
      borderWidth: 2,
      fill: true,
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx) => `R$ ${ctx.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
        }
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: (v) => `R$ ${(v/1000).toFixed(0)}k`
        }
      }
    }
  }
};
```

## 🗂️ Tabela de Dados
### Especificação
- **Biblioteca**: Nativa (sem dependência extra) — `<table>` HTML estilizado
- **Paginação**: 15 registros por página, navegação anterior/próxima
- **Ordenação**: Clique no header da coluna alterna ASC/DESC
- **Formatação monetária**: `toLocaleString('pt-BR', {style:'currency', currency:'BRL'})`
- **Formatação de data**: `new Date(date).toLocaleDateString('pt-BR')`

## 🔧 Filtros
### Seletor de Período
Opções pré-definidas: Hoje | 7 dias | 30 dias | 90 dias | Personalizado
```jsx
<select className="period-select" onChange={handlePeriodChange}>
  <option value="today">Hoje</option>
  <option value="7d">Últimos 7 dias</option>
  <option value="30d" selected>Últimos 30 dias</option>
  <option value="90d">Últimos 90 dias</option>
  <option value="custom">Personalizado</option>
</select>
```

## 💀 Estado Vazio (Empty State)
```jsx
<div className="empty-state">
  <span className="empty-icon">📭</span>
  <h3>Nenhum dado encontrado</h3>
  <p>Os dados para o período selecionado ainda não foram coletados.</p>
  <button onClick={refresh}>Tentar novamente</button>
</div>
```
```

## Quality Criteria

- [ ] KPICard completamente especificado (HTML, CSS, estados)
- [ ] Configuração Chart.js para cada tipo de gráfico usado
- [ ] Tabela especificada (formatação, paginação, ordenação)
- [ ] Filtros de período especificados
- [ ] Estados de loading, vazio e erro especificados
- [ ] Versão da biblioteca Chart.js especificada (LTS)

## Veto Conditions

Rejeitar e refazer se:
1. Código CSS/JSX ausente — apenas descrição não é suficiente para o Fábio implementar
2. Versão da biblioteca Chart.js não especificada (risco de usar versão incompatível)
