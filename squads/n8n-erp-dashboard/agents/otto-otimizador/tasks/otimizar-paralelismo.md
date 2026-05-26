---
task: "Otimizar Paralelismo e Estrutura do Workflow"
order: 2
input: |
  - performance_baseline: análise da task anterior
  - workflow_json: squads/n8n-erp-dashboard/output/workflow-n8n.json
output: |
  - workflow_paralelo: versão do workflow com branches paralelos e estrutura otimizada
---

# Otimizar Paralelismo e Estrutura do Workflow

Com o grafo de dependências mapeado, reestruturar o workflow para executar em paralelo todos os branches independentes, eliminando esperas desnecessárias.

## Process

1. **Reestruturar branches paralelos**: Usar Split/Merge do N8N para executar os 4 relatórios simultaneamente
2. **Centralizar token**: Garantir que o `access_token` é obtido UMA VEZ e compartilhado via `$workflow.variables` ou passado como item para todos os branches
3. **Implementar paginação paralela** (quando seguro):
   - Buscar página 1 → extrair `TotalPaginas`
   - Se `TotalPaginas > 1`, criar N requests paralelos para páginas 2..N
   - Limitar a 5 requests paralelos por vez para respeitar rate limit
4. **Eliminar nodes redundantes**: Remover Set/Code nodes que apenas passam dados adiante sem transformação
5. **Otimizar Wait nodes**: Calcular delay mínimo seguro com base no número de branches paralelos

## Cálculo de Delay com Paralelismo

```
Rate limit: 100 req/min por endpoint = 1 req/600ms por endpoint

Com 4 branches paralelos, cada endpoint ainda é chamado sequencialmente
dentro do seu próprio branch → delay de 650ms entre pages dentro de cada branch
é suficiente e seguro.

Para paginação paralela (múltiplas páginas ao mesmo tempo):
- Máximo 5 páginas simultâneas
- Delay entre batches de 5: 3500ms
```

## Output Format

```markdown
# Otimizações de Paralelismo Aplicadas

## Antes vs. Depois

| Métrica | Antes (Sequencial) | Depois (Paralelo) | Ganho |
|---------|-------------------|-------------------|-------|
| Tempo estimado | X min | Y min | Z% mais rápido |
| Calls à API | X | X (mesmo) | — |
| Nodes | X | Y | -Z nodes redundantes |

## Estrutura Paralela Proposta

```
[Schedule Trigger]
    ↓
[HTTP POST: Obter Token] → Salvar em $vars.token
    ↓
[Split: 4 branches paralelos] ←─── FAN-OUT
    ┌────────┬────────┬─────────┬──────────┐
    ▼        ▼        ▼         ▼
[Vendas] [Estoque] [C.Pagar] [C.Receber]
    └────────┴────────┴─────────┴──────────┘
    ↓
[Merge: aguardar todos] ←─── FAN-IN
    ↓
[Transform + Save]
```

## Nodes Eliminados
1. [Node X] — motivo: redundante, apenas passava dados sem transformar
2. ...
```
