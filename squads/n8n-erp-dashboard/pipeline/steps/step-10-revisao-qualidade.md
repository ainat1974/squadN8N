---
execution: inline
agent: renata-revisao
inputFile: squads/n8n-erp-dashboard/output/dashboard-app.md
outputFile: squads/n8n-erp-dashboard/output/quality-report.md
---

# Step 10: Revisão Final de Qualidade

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/api-documentation.md` — Documentação da API
- `squads/n8n-erp-dashboard/output/workflow-n8n.json` — Workflow N8N gerado
- `squads/n8n-erp-dashboard/output/data-schema.md` — Schema de dados
- `squads/n8n-erp-dashboard/output/design-spec.md` — Especificação de design
- `squads/n8n-erp-dashboard/output/dashboard-app.md` — Código do dashboard

## Instructions

### Process
1. **Executar as 3 tasks da Renata em sequência**:
   - Task 1: `revisar-integracao-api.md` — segurança e robustez da integração
   - Task 2: `revisar-workflow-n8n.md` — qualidade do workflow N8N
   - Task 3: `revisar-dashboard.md` — código backend, frontend, versões e acessibilidade
2. **Classificar cada problema** como BLOQUEANTE ou NÃO-BLOQUEANTE
3. **Propor correção** para cada item encontrado
4. **Emitir veredicto final**: APROVADO ou REPROVADO (com lista de ações necessárias)

## Output Format

```markdown
# Relatório Final de Qualidade — N8N ERP Dashboard Squad

## Resumo Executivo
- Data da revisão: YYYY-MM-DD
- Agentes revisados: 6 (Artur, Nelson, Dante, Diana, Fábio)
- Itens bloqueantes: X
- Itens não-bloqueantes: Y
- **Veredicto: ✅ APROVADO / 🔴 REPROVADO**

## Revisão 1: Integração API Dapic
[checklist + problemas encontrados]

## Revisão 2: Workflow N8N
[checklist + versões verificadas]

## Revisão 3: Dashboard (Backend + Frontend)
[checklist + versões + segurança + acessibilidade]

## 🔴 Itens Bloqueantes (obrigatório corrigir antes de produção)
1. [problema] — Risco: [X] — Correção: [Y]

## 🟡 Itens Não-Bloqueantes (melhorar na próxima versão)
1. [melhoria]

## Próximos Passos para Produção
[Lista de ações necessárias]
```

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. Relatório sem veredicto claro (APROVADO ou REPROVADO)
2. Versões de dependências não verificadas

## Quality Criteria

- [ ] Todos os 3 domínios revisados (API, N8N, Dashboard)
- [ ] Itens classificados como bloqueante/não-bloqueante
- [ ] Veredicto final claro
- [ ] Próximos passos listados
- [ ] Versões de todas as dependências verificadas
