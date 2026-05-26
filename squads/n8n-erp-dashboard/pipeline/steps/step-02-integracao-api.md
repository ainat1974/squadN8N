---
execution: subagent
agent: artur-api
inputFile: squads/n8n-erp-dashboard/output/foco-coleta.md
outputFile: squads/n8n-erp-dashboard/output/api-documentation.md
model_tier: powerful
---

# Step 02: Integração e Documentação da API Dapic

## Context Loading

Load these files before executing:
- `squads/n8n-erp-dashboard/output/foco-coleta.md` — Foco definido no checkpoint (relatórios, período, URL da API)
- `squads/n8n-erp-dashboard/_opensquad/_memory/company.md` — Contexto da empresa
- `squads/n8n-erp-dashboard/pipeline/data/domain-framework.md` — Framework de integração de APIs

## Instructions

### Process
1. **Ler o foco definido**: Quais relatórios coletar e a URL da API Dapic informada no checkpoint
2. **Executar as 3 tasks do Artur API em sequência**:
   - Task 1: `mapear-endpoints.md` — pesquisar e documentar todos os endpoints
   - Task 2: `validar-autenticacao.md` — documentar fluxo de autenticação completo
   - Task 3: `documentar-schemas.md` — documentar schemas JSON de resposta de cada endpoint
3. **Usar web_fetch** para acessar a documentação oficial da API Dapic se URL disponível
4. **Usar web_search** se necessário para encontrar informações sobre a API Dapic
5. **Compilar tudo** em um único arquivo `api-documentation.md` bem estruturado

## Output Format

```markdown
# Documentação Técnica — API Dapic

## Versão da API
## Autenticação
### Método
### Fluxo de Obtenção de Token
### Renovação de Token
### Configuração no N8N

## Endpoints

### Vendas
#### URL e Método
#### Parâmetros
#### Schema de Resposta
#### Paginação
#### Rate Limits

### Estoque
...

### Contas a Pagar
...

### Contas a Receber
...

## Resumo para o Nelson N8N
(Tabela de campos críticos a mapear por relatório)
```

## Output Example

Documentação completa e estruturada da API Dapic com:
- Todos os endpoints dos 4 relatórios documentados
- Fluxo de autenticação passo a passo
- Schemas JSON com exemplos realistas
- Campos críticos para o N8N mapeados

## Veto Conditions

Rejeitar e refazer se ANY são verdadeiros:
1. Algum dos relatórios solicitados não foi documentado
2. Método de autenticação não identificado
3. Schemas JSON ausentes ou incompletos

## Quality Criteria

- [ ] Todos os endpoints solicitados documentados
- [ ] Autenticação documentada com exemplo de header
- [ ] Schemas JSON com tipos de dados especificados
- [ ] Rate limits identificados
- [ ] Paginação documentada para endpoints paginados
