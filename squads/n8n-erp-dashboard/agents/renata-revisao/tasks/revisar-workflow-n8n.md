---
task: "Revisar Workflow N8N"
order: 2
input: |
  - workflow_json: JSON do workflow N8N gerado pelo Nelson N8N
output: |
  - workflow_review: Relatório de revisão do workflow N8N
---

# Revisar Workflow N8N

Revisa o workflow N8N quanto a boas práticas, segurança, robustez e compatibilidade com a versão estável do N8N.

## Process

1. **Verificar versões dos nodes**: Confirmar que `typeVersion` de cada node é compatível com N8N v1.x LTS estável
2. **Verificar error handling**: Todo HTTP Request node deve ter branch de erro mapeada
3. **Verificar idempotência**: Workflow executado duas vezes não deve duplicar dados
4. **Verificar paginação**: Loop de paginação implementado para todos os endpoints paginados
5. **Verificar agendamento**: Expressão cron correta para execução diária

## Output Format

```markdown
# Revisão: Workflow N8N

## Checklist de Versões
- [ ] N8N target: v1.x LTS
- [ ] scheduleTrigger typeVersion: 1.1
- [ ] httpRequest typeVersion: 4.x
- [ ] set typeVersion: 3.x

## Checklist de Robustez
- [ ] Error Trigger configurado
- [ ] Todos HTTP Request com error output
- [ ] Paginação implementada
- [ ] Idempotência verificada

## 🔴 Bloqueantes
...

## Veredicto: APROVADO / REPROVADO
```

## Quality Criteria

- [ ] typeVersion de todos os nodes compatível com N8N LTS
- [ ] Error handling em todos os HTTP Request nodes
- [ ] Cron expression correta (`0 6 * * *`)
- [ ] Paginação implementada
- [ ] Sem credentials hardcoded no JSON

## Veto Conditions

Rejeitar e refazer se:
1. Algum HTTP Request node sem error output mapeado
2. Credentials hardcoded encontradas no JSON do workflow
