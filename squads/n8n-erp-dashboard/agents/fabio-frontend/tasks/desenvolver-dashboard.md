---
task: "Desenvolver Dashboard React"
order: 3
input: |
  - backend_code: API backend implementada
  - design_spec: Especificação completa de componentes e layout (Diana Design)
output: |
  - dashboard_code: Código completo do frontend React com dashboard interativo
---

# Desenvolver Dashboard React Interativo

Implementa o frontend React completo seguindo a especificação da Diana Design — todos os painéis, componentes, gráficos e filtros do dashboard ERP.

## Process

1. **Implementar componentes base**: KPICard, LineChart, BarChart, DonutChart, DataTable, Skeleton, EmptyState com CSS dos tokens do design system
2. **Implementar hook useApiData**: Hook customizado para fetch com estados de loading, error e data
3. **Implementar utilitários (formatters.js)**: Formatação monetária pt-BR, datas, percentuais
4. **Implementar páginas**: Resumo, Vendas, Estoque, ContasPagar, ContasReceber com React Router 6
5. **Implementar Sidebar e App.jsx**: Navegação, roteamento e layout principal responsivo

## Output Format

```jsx
// Estrutura de cada componente
// src/components/KPICard/KPICard.jsx

/**
 * KPICard — Exibe um indicador-chave com valor, tendência e variação.
 * @param {string} title - Título do KPI
 * @param {string|number} value - Valor principal formatado
 * @param {number} trend - Variação percentual (positivo = crescimento)
 * @param {string} icon - Emoji do ícone
 * @param {boolean} loading - Estado de carregamento
 */
function KPICard({ title, value, trend, icon, loading }) { ... }
```

## Output Example

```jsx
// src/utils/formatters.js
/**
 * Formata um número como moeda brasileira (BRL).
 * @param {number} value
 * @returns {string} Ex: "R$ 1.425,00"
 */
export const formatCurrency = (value) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

/**
 * Formata uma string ISO de data para pt-BR.
 * @param {string} dateStr - "2024-01-15"
 * @returns {string} "15/01/2024"
 */
export const formatDate = (dateStr) =>
  new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR');

/**
 * Formata variação percentual com sinal.
 * @param {number} value
 * @returns {string} "+12,5%" ou "-3,2%"
 */
export const formatPercent = (value) =>
  `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`;

// src/hooks/useApiData.js
import { useState, useEffect } from 'react';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

/**
 * Hook para fetch de dados da API com estados de loading e error.
 * @param {string} endpoint - Rota da API (ex: '/api/dashboard/vendas')
 * @param {Object} params - Query params (ex: { period: '30d' })
 */
export function useApiData(endpoint, params = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const queryString = new URLSearchParams(params).toString();
    const url = `${API_BASE}${endpoint}${queryString ? '?' + queryString : ''}`;

    setLoading(true);
    setError(null);

    fetch(url)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(json => setData(json.data))
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  }, [endpoint, JSON.stringify(params)]);

  return { data, loading, error };
}

// src/components/KPICard/KPICard.jsx
import './KPICard.css';

export function KPICard({ title, value, trend, icon, loading }) {
  if (loading) {
    return (
      <div className="kpi-card kpi-card--loading" aria-busy="true" aria-label="Carregando...">
        <div className="skeleton skeleton--sm" />
        <div className="skeleton skeleton--lg" />
        <div className="skeleton skeleton--sm" />
      </div>
    );
  }

  const trendDir = trend > 0 ? 'up' : trend < 0 ? 'down' : 'neutral';
  const trendIcon = trend > 0 ? '▲' : trend < 0 ? '▼' : '→';

  return (
    <div className="kpi-card" role="region" aria-label={title}>
      <div className="kpi-header">
        <span className="kpi-icon" aria-hidden="true">{icon}</span>
        <span className="kpi-title">{title}</span>
      </div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-trend kpi-trend--${trendDir}`} aria-label={`Variação: ${trend}%`}>
        {trendIcon} {Math.abs(trend).toFixed(1)}% vs. ontem
      </div>
    </div>
  );
}

// src/pages/Vendas.jsx
import { useState } from 'react';
import { useApiData } from '../hooks/useApiData';
import { KPICard } from '../components/KPICard/KPICard';
import { LineChart } from '../components/Charts/LineChart';
import { DataTable } from '../components/DataTable/DataTable';
import { formatCurrency, formatPercent } from '../utils/formatters';

export function Vendas() {
  const [period, setPeriod] = useState('30d');
  const { data, loading, error } = useApiData('/api/dashboard/vendas', { period });

  if (error) return (
    <div className="error-state" role="alert">
      <span>⚠️</span>
      <p>Não foi possível carregar os dados de vendas.</p>
      <button onClick={() => window.location.reload()}>Tentar novamente</button>
    </div>
  );

  return (
    <main className="page-vendas">
      <header className="page-header">
        <h1>Vendas</h1>
        <select
          value={period}
          onChange={e => setPeriod(e.target.value)}
          aria-label="Selecionar período"
          className="period-select"
        >
          <option value="7d">Últimos 7 dias</option>
          <option value="30d">Últimos 30 dias</option>
          <option value="90d">Últimos 90 dias</option>
        </select>
      </header>

      <section className="kpi-grid" aria-label="Indicadores de vendas">
        <KPICard title="Total de Vendas" value={data?.summary.total_vendas ?? '-'} trend={0} icon="🛒" loading={loading} />
        <KPICard title="Receita Total" value={data ? formatCurrency(data.summary.receita_total) : '-'} trend={data?.summary.variacao_receita ?? 0} icon="💰" loading={loading} />
        <KPICard title="Ticket Médio" value={data ? formatCurrency(data.summary.ticket_medio) : '-'} trend={0} icon="🎫" loading={loading} />
      </section>

      <section className="charts-grid">
        <div className="chart-container chart-container--large">
          <h2>Evolução de Receita</h2>
          {!loading && data && <LineChart data={data.serie_temporal} />}
        </div>
      </section>

      <section className="table-section">
        <h2>Últimas Vendas</h2>
        <DataTable
          data={data?.raw_data ?? []}
          loading={loading}
          columns={[
            { key: 'data_venda', label: 'Data', format: 'date' },
            { key: 'cliente.nome', label: 'Cliente' },
            { key: 'valor_total', label: 'Valor', format: 'currency' },
            { key: 'status', label: 'Status' }
          ]}
        />
      </section>
    </main>
  );
}
```

## Quality Criteria

- [ ] Todos os componentes base implementados (KPICard, Charts, DataTable, Skeleton)
- [ ] Hook useApiData com loading, error e data implementado
- [ ] Formatters pt-BR implementados (moeda, data, percentual)
- [ ] Todas as 5 páginas implementadas (Resumo, Vendas, Estoque, CP, CR)
- [ ] React Router 6 configurado com rotas para cada página
- [ ] Responsivo com Tailwind CSS breakpoints
- [ ] Acessibilidade: aria-labels, roles e navegação por teclado

## Veto Conditions

Rejeitar e refazer se:
1. Alguma das 5 páginas não foi implementada
2. Não há tratamento de estado de erro (sem fallback visual para erros de API)
