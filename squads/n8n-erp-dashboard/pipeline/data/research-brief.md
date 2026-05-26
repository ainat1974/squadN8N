# Research Brief — N8N ERP Dashboard Squad

## Domínio: Automação N8N + Integração de API + Dashboard Web

---

## 1. N8N — Automação de Workflows

### Versões e Compatibilidade
- **N8N v1.x LTS** é a versão estável recomendada para produção
- Nodes principais para integração de API: `HTTP Request (typeVersion 4.2)`, `Schedule Trigger (typeVersion 1.1)`, `Function`, `Set (typeVersion 3.4)`, `IF`, `Wait`, `Merge`
- `Error Trigger` é o node padrão para captura de erros em workflows

### Boas Práticas N8N em Produção
- Usar **N8N Variables** para armazenar URLs e credenciais (Settings → Variables)
- Ativar **saveManualExecutions: true** para debug
- Usar **executionOrder: "v1"** para workflows lineares
- Implementar **Error Workflow** separado para alertas críticos
- Logs de execução ficam disponíveis em Settings → Executions por 24h-30 dias (configurável)

### Padrão ETL com N8N
```
Schedule Trigger → Auth → For Each Endpoint { HTTP Request → IF paginated → Loop } → Function Transform → Write File
```

---

## 2. Integração de APIs REST

### Autenticação JWT/Bearer (padrão moderno)
- Obter token via `POST /auth/token` com credenciais
- Usar em header: `Authorization: Bearer {token}`
- Token com validade típica: 1h — renovar antes de expirar
- Em caso de 401: renovar token e retry automático

### Rate Limiting
- Padrão conservador: 1 req/segundo (1000ms de delay)
- HTTP 429 = rate limit atingido — aguardar `Retry-After` header ou 60s
- Implementar exponential backoff para retries

### Paginação REST (padrões comuns)
- `?page=1&limit=100` com meta `{ total, page, per_page, total_pages }`
- `?offset=0&limit=100` com `{ count, next, previous }`
- Loop até `page >= total_pages` ou `next === null`

---

## 3. Engenharia de Dados

### Tipos de Dados Críticos
- **Monetário**: sempre `number` com 2 casas decimais — nunca string
- **Data**: sempre ISO 8601 `YYYY-MM-DD` — nunca `DD/MM/YYYY`
- **ID**: sempre `string` — IDs numéricos são coincidência, não garantia
- **Status**: normalizar para lowercase — `"FATURADO"` → `"faturado"`

### ETL Idempotente
- Estratégia: snapshot por data em diretório separado
- Re-execução substitui o snapshot do dia (não duplica)
- Dados históricos preservados em pastas por data

### Schema de Dashboard (padrão)
```json
{
  "date": "YYYY-MM-DD",
  "collected_at": "ISO8601",
  "summary": { "total": 0, "variacao_pct": 0 },
  "serie_temporal": [{ "data": "YYYY-MM-DD", "valor": 0 }],
  "detalhes": []
}
```

---

## 4. Stack Frontend — React + Chart.js

### Chart.js v4.x — Tipos de Gráfico Recomendados
| Caso de Uso | Tipo | Configuração |
|---|---|---|
| Evolução temporal | `line` | `fill: true, tension: 0.4` |
| Comparação por categoria | `bar` | `borderRadius: 6` |
| Distribuição proporcional | `doughnut` | `cutout: '70%'` |
| Ranking horizontal | `bar` (horizontal) | `indexAxis: 'y'` |

### React 18 + Performance
- `React.memo` para componentes de gráfico (evitar re-render desnecessário)
- `useMemo` para cálculos pesados (aggregations de dados)
- `useCallback` para handlers passados como props
- Lazy loading de páginas com `React.lazy + Suspense`

### Formatação pt-BR
```javascript
// Monetário
new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)

// Data
new Date(dateStr + 'T00:00:00').toLocaleDateString('pt-BR')

// Percentual
`${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
```

---

## 5. Segurança de API Web

### Backend Express — Checklist Mínimo
- `helmet()` — headers de segurança HTTP
- `cors({ origin: process.env.FRONTEND_URL })` — nunca `*` em produção
- Validação de query params (evitar path traversal em leitura de arquivos)
- Rate limiting com `express-rate-limit` se exposto publicamente
- Nunca expor stack traces em respostas de erro (apenas em desenvolvimento)

### OWASP Top 10 — Relevantes para este Projeto
1. **A01 Broken Access Control**: Garantir que a API backend não seja acessível publicamente sem autenticação
2. **A02 Cryptographic Failures**: Dados do ERP em trânsito sempre via HTTPS
3. **A05 Security Misconfiguration**: CORS restritivo, headers de segurança via helmet
