---
task: "Revisar Dashboard e Código Frontend/Backend"
order: 3
input: |
  - dashboard_app: Código completo do dashboard gerado pelo Fábio Frontend
output: |
  - quality_report: Relatório final de qualidade de toda a implementação
---

# Revisar Dashboard e Código Frontend/Backend

Revisa o código completo do dashboard — backend Node.js e frontend React — quanto a segurança, qualidade, acessibilidade, responsividade e documentação.

## Process

1. **Verificar versões de dependências**: Node.js >=22 LTS, React 18.x, Chart.js 4.x, Express 4.x — nenhuma versão beta ou deprecated
2. **Revisar segurança do backend**: helmet, cors configurado, sem credentials expostas, .env.example presente
3. **Revisar qualidade do código React**: Sem useEffect com dependências faltando, componentes com responsabilidade única, sem console.log em produção
4. **Revisar acessibilidade**: aria-labels, roles, navegação por teclado nos componentes interativos
5. **Compilar relatório final**: Consolidar todos os itens bloqueantes e não-bloqueantes de todas as revisões

## Output Format

```markdown
# Relatório Final de Qualidade — N8N ERP Dashboard Squad

## Resumo Executivo
- Agentes revisados: 5
- Itens bloqueantes encontrados: X
- Itens não-bloqueantes: Y
- Veredicto geral: ✅ APROVADO / 🔴 REPROVADO

## Revisão: Backend Node.js
### Versões
- Node.js: [versão] — ✅/🔴
- Express: [versão] — ✅/🔴

### Segurança
- [ ] helmet instalado e configurado
- [ ] cors com origin específico
- [ ] .env.example atualizado

## Revisão: Frontend React
### Versões
- React: [versão] — ✅/🔴
- Chart.js: [versão] — ✅/🔴

### Qualidade
- [ ] useEffect com dependências corretas
- [ ] Sem console.log em produção
- [ ] Tratamento de loading/error/empty

### Acessibilidade (WCAG AA)
- [ ] aria-labels em elementos interativos
- [ ] Navegação por teclado funcional
- [ ] Contraste verificado

## 🔴 Itens Bloqueantes (todos devem ser corrigidos)
1. [problema] — [risco] — [correção]

## 🟡 Itens Não-Bloqueantes (melhorias recomendadas)
1. [melhoria]

## Próximos Passos
[Lista de ações necessárias antes de ir para produção]
```

## Quality Criteria

- [ ] Versões de TODAS as dependências verificadas
- [ ] Segurança do backend revisada (helmet, cors, sem credentials)
- [ ] Acessibilidade verificada (aria-labels, roles)
- [ ] Tratamento de loading/erro/vazio verificado em todos os componentes
- [ ] README com instruções de setup verificado
- [ ] Relatório final gerado com veredicto claro

## Veto Conditions

Rejeitar e refazer se:
1. Versão de alguma dependência crítica não verificada
2. Relatório sem veredicto claro (APROVADO ou REPROVADO)
