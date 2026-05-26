---
task: "Otimizar Calls à API e Resiliência"
order: 3
input: |
  - workflow_paralelo: versão paralelizada da task anterior
output: |
  - workflow_otimizado_final: workflow final com retry inteligente, paginação eficiente e calls minimizadas
  - relatorio_otimizacao: comparativo completo antes/depois
---

# Otimizar Calls à API e Resiliência

Minimizar o número de chamadas à API Dapic e tornar o workflow resiliente a falhas transitórias com retry inteligente.

## Process

### 1. Maximizar RegistrosPorPagina
Garantir que TODOS os endpoints paginados usam `RegistrosPorPagina=200` (máximo permitido pela API Dapic). Isso reduz o número de páginas necessárias em ~20x comparado ao padrão de 10.

```
Exemplo: 1500 registros
- Padrão (10/página): 150 calls
- Otimizado (200/página): 8 calls  ← 94% menos calls
```

### 2. Retry com Backoff Exponencial
Substituir falha imediata por retry inteligente para erros transitórios:

```javascript
// Code node: Retry Logic
const maxRetries = 3;
const delays = [1000, 2000, 4000]; // backoff exponencial

// Para HTTP 429 (rate limit): aguardar e tentar novamente
// Para HTTP 5xx (servidor): retry com backoff
// Para HTTP 4xx (exceto 429): falha imediata (erro no request)
// Para HTTP 401: renovar token e retry uma vez
```

### 3. Detecção e Renovação de Token Expirado
Implementar verificação de 401: se recebido durante execução, renovar token automaticamente e repetir o request — sem precisar reiniciar o workflow inteiro.

### 4. Calls Desnecessárias Eliminadas
Identificar e remover:
- Requests de "verificação" que não contribuem para os dados finais
- Calls a endpoints de detalhe quando o endpoint de lista já tem os dados necessários para o dashboard

### 5. Janela de 31 dias — Movimentações de Estoque
Para o endpoint `/v1/movimentacoesestoque` com coleta histórica > 31 dias:
```
Período de 90 dias → 3 requests paralelos de 30 dias cada
Período de 31 dias → 1 request único
Período ≤ 31 dias → 1 request único
```

## Output Format

```markdown
# Relatório de Otimização — Workflow N8N ERP Dapic

## Resumo Executivo

| Métrica | Original (Nelson) | Otimizado (Otto) | Melhoria |
|---------|------------------|------------------|----------|
| Tempo estimado | X min Y seg | A min B seg | C% mais rápido |
| Calls à API | X calls | Y calls | -Z calls (-W%) |
| Nodes no workflow | X | Y | -Z nodes |
| Resiliência a falhas | Falha imediata | Retry 3x backoff exp. | ✅ |
| Paralelismo | Sequencial | 4 branches paralelos | ✅ |

## Otimizações Aplicadas

### 1. Paralelismo (ganho: -Xmin)
[descrição]

### 2. RegistrosPorPagina=200 (ganho: -X calls)
[descrição]

### 3. Retry com Backoff Exponencial
[descrição]

### 4. Nodes eliminados (-X nodes)
[lista]

### 5. Token centralizado
[descrição]

## Constraints Verificados

- [x] Rate limit respeitado com paralelismo: X req/min por endpoint (limite: 100)
- [x] Workflow idempotente: executar 2x não duplica dados
- [x] Error handling preservado em todos os HTTP nodes
- [x] Movimentações de estoque: janela de 31 dias respeitada

## Arquivo de Output
→ `squads/n8n-erp-dashboard/output/workflow-n8n-otimizado.json`
```

## Quality Criteria

- [ ] RegistrosPorPagina=200 em todos os endpoints paginados
- [ ] Retry com backoff exponencial implementado (1s, 2s, 4s)
- [ ] Renovação automática de token em caso de 401
- [ ] Janela de 31 dias respeitada para Movimentações de Estoque
- [ ] Relatório de otimização com métricas antes/depois
- [ ] Workflow idempotente verificado após otimizações
