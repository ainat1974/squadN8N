---
execution: subagent
agent: dante-dados
inputFile: squads/n8n-erp-dashboard/output/api-documentation.md
outputFile: squads/n8n-erp-dashboard/output/data-schema.md
model_tier: powerful
---

# Step 05: Transformação e Schema de Dados

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/api-documentation.md` — Schemas brutos da API Dapic
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Framework de engenharia de dados

## Instructions

### Process
1. **Analisar schemas brutos**: Identificar campos, tipos, inconsistências e problemas nos dados de cada relatório
2. **Executar as 3 tasks do Dante Dados em sequência**:
   - Task 1: `analisar-dados-brutos.md` — inventariar campos e detectar problemas
   - Task 2: `projetar-transformacoes.md` — definir transformações com código JavaScript
   - Task 3: `definir-schema-armazenamento.md` — schema de saída e estratégia de armazenamento
3. **Incluir código de transformação** pronto para usar no N8N Function node
4. **Definir endpoints da API backend** que o Fábio Frontend precisará implementar
5. **Documentar KPIs calculados**: Receita total, ticket médio, saldo CP vs CR, variação diária

## Output Format

```markdown
# Schema de Dados — ERP Dapic Dashboard

## Análise dos Dados Brutos
### Problemas Identificados por Relatório

## Funções de Transformação (JavaScript)
```javascript
// Pronto para N8N Function node
```

## Schema de Saída por Relatório
### vendas.json
```json
{ ... }
```

## Estrutura de Diretórios
## Endpoints da API Backend
## Estratégia de Retenção
```

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. Schema de saída incompleto (algum relatório sem schema)
2. Endpoints da API backend não especificados
3. Código de transformação com erro de sintaxe JavaScript

## Quality Criteria

- [ ] Schema de saída definido para todos os 4 relatórios
- [ ] Código JavaScript de transformação funcional
- [ ] Todos os valores monetários definidos como `number`
- [ ] Datas normalizadas para ISO 8601
- [ ] Endpoints da API backend especificados
- [ ] Estratégia de retenção de dados definida
