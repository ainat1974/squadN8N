---
execution: subagent
agent: fabio-frontend
inputFile: squads/n8n-erp-dashboard/output/design-spec.md
outputFile: squads/n8n-erp-dashboard/output/dashboard-app.md
model_tier: powerful
---

# Step 08: Desenvolvimento do Dashboard

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/design-spec.md` — Especificação completa de design (tokens, layouts, componentes)
- `squads/n8n-erp-dashboard/output/data-schema.md` — Schema de dados e endpoints da API backend
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Framework de desenvolvimento

## Instructions

### Process
1. **Ler especificações de design e dados**: Tokens CSS, layouts, componentes e endpoints da API backend
2. **Executar as 3 tasks do Fábio Frontend em sequência**:
   - Task 1: `criar-estrutura-projeto.md` — estrutura de arquivos e package.json com versões LTS
   - Task 2: `implementar-api-backend.md` — Node.js/Express com todos os endpoints
   - Task 3: `desenvolver-dashboard.md` — React com todos os painéis e componentes
3. **Usar versões LTS estáveis**: Node.js 22.x, React 18.x, Express 4.x, Chart.js 4.x, Vite 5.x
4. **Implementar todos os componentes** com tratamento de loading, erro e estado vazio
5. **Gerar README completo** com instruções de setup e deploy

## Output Format

```markdown
# Aplicação Dashboard ERP Dapic — Código Gerado

## Estrutura do Projeto
[Árvore de arquivos]

## Backend — Node.js/Express
### src/index.js
```javascript
[código completo]
```
### src/services/dataService.js
```javascript
[código completo]
```
### src/routes/*.js
[todos os endpoints]

## Frontend — React
### src/utils/formatters.js
### src/hooks/useApiData.js
### src/components/KPICard/KPICard.jsx + KPICard.css
### src/components/Charts/*.jsx
### src/pages/*.jsx
### src/App.jsx

## Arquivos de Configuração
### package.json (backend e frontend)
### .env.example
### vite.config.js
### tailwind.config.js

## README.md
[Instruções completas de setup, desenvolvimento e produção]
```

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. Alguma das 5 páginas (Resumo, Vendas, Estoque, CP, CR) não foi implementada
2. Versões de dependências não especificadas nos package.json
3. Não há tratamento de erro em componentes que fazem fetch

## Quality Criteria

- [ ] Backend com todos os 5 endpoints implementados
- [ ] Frontend com todas as 5 páginas implementadas
- [ ] Versões LTS especificadas em ambos os package.json
- [ ] useApiData hook com loading, error e data
- [ ] Formatação monetária pt-BR em todos os valores
- [ ] Responsivo nos breakpoints definidos pelo Diana Design
- [ ] README com setup completo
- [ ] .env.example com todas as variáveis
