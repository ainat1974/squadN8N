---
execution: subagent
agent: nelson-n8n
inputFile: squads/n8n-erp-dashboard/output/api-documentation.md
outputFile: squads/n8n-erp-dashboard/output/workflow-n8n.json
model_tier: powerful
---

# Step 03: Criação do Workflow N8N

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/api-documentation.md` — Documentação completa da API Dapic
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Framework de automação N8N

## Instructions

### Process
1. **Ler documentação da API**: Endpoints, autenticação, schemas e rate limits documentados pelo Artur API
2. **Executar as 3 tasks do Nelson N8N em sequência**:
   - Task 1: `projetar-workflow.md` — definir arquitetura e diagrama do workflow
   - Task 2: `gerar-workflow-json.md` — gerar o JSON completo para importação no N8N
   - Task 3: `configurar-agendamento.md` — criar guia de deploy para https://workflows.tmrodrigues.tech/
3. **Gerar JSON válido** compatível com N8N v1.x LTS estável
4. **Incluir todos os nodes necessários**: Cron, HTTP Request (auth), HTTP Request (dados), Function (transformação), IF (paginação), Wait (rate limit), Error handling
5. **Salvar JSON do workflow** como arquivo principal de output

## Output Format

```json
{
  "name": "ERP Dapic — Coleta Diária",
  "nodes": [...],
  "connections": {...},
  "settings": { "executionOrder": "v1" },
  "tags": ["erp", "dapic", "coleta-dados"]
}
```

Acompanhar o JSON com:
```markdown
## Guia de Deploy
[Instruções de importação e configuração no N8N]

## Diagrama do Workflow
[Representação ASCII do fluxo]

## Nodes Utilizados
[Tabela: nome, tipo, função]
```

## Output Example

Arquivo JSON válido do workflow N8N com:
- Cron trigger para execução diária às 06:00
- Fluxo de autenticação com renovação de token
- Coleta paginada dos 4 relatórios com delay de rate limiting
- Error handling em todos os HTTP nodes
- Instruções de deploy para https://workflows.tmrodrigues.tech/

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. JSON inválido (erro de sintaxe)
2. Algum HTTP Request node sem error output
3. Credentials hardcoded no JSON

## Quality Criteria

- [ ] JSON válido e importável no N8N
- [ ] Cron configurado para execução diária
- [ ] Error handling em todos os HTTP nodes
- [ ] Rate limiting implementado (Wait node)
- [ ] Paginação implementada para endpoints paginados
- [ ] Guia de deploy para https://workflows.tmrodrigues.tech/ incluído
