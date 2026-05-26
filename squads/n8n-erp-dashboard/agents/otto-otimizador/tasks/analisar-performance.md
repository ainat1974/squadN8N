---
task: "Analisar Performance do Workflow Original"
order: 1
input: |
  - workflow_json: squads/n8n-erp-dashboard/output/workflow-n8n.json
  - api_docs: squads/n8n-erp-dashboard/pipeline/data/dapic-api.md
output: |
  - performance_baseline: análise de tempo estimado e gargalos do workflow original
---

# Analisar Performance do Workflow Original

Antes de otimizar, medir. Esta task gera o baseline de performance do workflow criado pelo Nelson — quantificando tempo estimado de execução, número de calls à API, sequências desnecessárias e gargalos identificados.

## Process

1. **Ler o workflow JSON** gerado pelo Nelson
2. **Mapear o grafo de dependências**: quais nodes dependem do output de quais outros
3. **Contar calls à API**: total de HTTP Request nodes, endpoints atingidos, paginação estimada
4. **Estimar tempo de execução sequencial**:
   - Latência média por call Dapic: ~500ms
   - Tempo de processamento por Code node: ~50ms
   - Wait nodes (rate limiting): conforme configurado
5. **Identificar gargalos**: nodes que bloqueiam o progresso sem necessidade
6. **Identificar sequências paralelizáveis**: branches sem dependência de dados entre si

## Output Format

```markdown
# Análise de Performance — Workflow Original

## Resumo
- Total de nodes: X
- Total de HTTP Request nodes: X
- Calls à API estimadas por execução: X
- **Tempo estimado (sequencial): X min Y seg**

## Grafo de Dependências
[Mapa de quais nodes dependem de quais]

Branch A (Vendas): independente
Branch B (Estoque): independente de A
Branch C (Contas a Pagar): independente de A e B
Branch D (Contas a Receber): independente de A, B e C
→ Todos os 4 branches podem rodar em PARALELO

## Gargalos Identificados
1. [Gargalo 1] — impacto estimado: +Xs no tempo total
2. [Gargalo 2] — ...

## Calls à API por Branch
| Branch | Endpoint | Pages estimadas | Calls totais | Tempo estimado |
|--------|----------|-----------------|--------------|----------------|
| Vendas | /v1/pedidosvendas | ~3 | 3 | ~1.5s |
| ...    | ...      | ...             | ...          | ...            |
| **TOTAL** | | | **X calls** | **X min** |

## Rate Limit — Situação Atual
- Execução sequencial: X calls/min por endpoint (seguro / em risco)
- Com paralelismo proposto: X calls/min por endpoint (verificar)
```
