---
task: "Revisar Integração com API Dapic"
order: 1
input: |
  - api_documentation: Documentação da API gerada pelo Artur API
output: |
  - api_review: Relatório de revisão da integração com a API
---

# Revisar Integração com API Dapic

Revisa a documentação e estratégia de integração com a API Dapic quanto a segurança, robustez e boas práticas.

## Process

1. **Verificar tratamento de credentials**: Confirmar que nenhuma credential real aparece na documentação
2. **Verificar estratégia de autenticação**: Token com renovação correta, tratamento de 401
3. **Verificar cobertura de endpoints**: Todos os 4 relatórios documentados com schema completo
4. **Verificar tratamento de erros**: Rate limiting (429), server error (500), not found (404)
5. **Verificar paginação**: Estratégia de coleta completa documentada para endpoints paginados

## Output Format

```markdown
# Revisão: Integração API Dapic

## ✅ Aprovações
- [ ] Credentials: sem hardcode
- [ ] Auth: renovação de token documentada
...

## 🔴 Bloqueantes
1. [Problema] — Risco: [X] — Correção: [Y]

## 🟡 Não-Bloqueantes
1. [Melhoria recomendada]

## Veredicto: APROVADO / REPROVADO
```

## Quality Criteria

- [ ] Nenhuma credential real encontrada na documentação
- [ ] Estratégia de renovação de token definida
- [ ] Todos os 4 endpoints documentados com schema
- [ ] Erros HTTP tratados (401, 429, 500)
- [ ] Paginação documentada

## Veto Conditions

Rejeitar e refazer se:
1. Credential real encontrada na documentação
2. Algum dos 4 relatórios sem schema de resposta documentado
