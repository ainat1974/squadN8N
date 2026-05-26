---
execution: subagent
agent: otto-otimizador
inputFile: squads/n8n-erp-dashboard/output/workflow-n8n.json
outputFile: squads/n8n-erp-dashboard/output/workflow-n8n-otimizado.json
model_tier: powerful
---

# Step 04: Otimização do Workflow N8N

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/workflow-n8n.json` — Workflow gerado pelo Nelson
- `squads/n8n-erp-dashboard/pipeline/data/dapic-api.md` — Constraints e rate limits da API Dapic
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Stack técnica e princípios ETL

## Instructions

### Process
1. **Executar as 3 tasks do Otto em sequência**:
   - Task 1: `analisar-performance.md` — baseline de tempo e gargalos do workflow original
   - Task 2: `otimizar-paralelismo.md` — reestruturar branches para execução paralela
   - Task 3: `otimizar-api-calls.md` — retry inteligente, paginação eficiente, calls minimizadas
2. **Gerar JSON otimizado** compatível com N8N v1.x (mesma estrutura do original, com melhorias)
3. **Gerar relatório** com comparativo antes/depois

## Output Format

Dois arquivos:

### 1. workflow-n8n-otimizado.json
JSON válido e importável no N8N — versão otimizada do workflow do Nelson.

### 2. relatorio-otimizacao.md
```markdown
# Relatório de Otimização — Otto

## Métricas Antes/Depois
[tabela comparativa]

## Otimizações Aplicadas
[lista com justificativas e ganhos quantificados]

## Constraints Verificados
[checklist de rate limit, idempotência, error handling]
```

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. JSON otimizado inválido (erro de sintaxe)
2. Rate limit violado com o paralelismo proposto (>100 req/min em qualquer endpoint)
3. Error handling removido em qualquer HTTP node
4. Workflow otimizado não é idempotente
5. Relatório sem métricas quantitativas (tempo antes/depois)

## Quality Criteria

- [ ] Tempo de execução estimado calculado antes E depois
- [ ] Branches paralelos implementados para os 4 relatórios
- [ ] RegistrosPorPagina=200 em todos os endpoints paginados
- [ ] Retry com backoff exponencial em erros 429/5xx
- [ ] Token obtido uma única vez e reutilizado em toda a execução
- [ ] JSON otimizado válido e importável no N8N
- [ ] Relatório com comparativo quantitativo gerado
