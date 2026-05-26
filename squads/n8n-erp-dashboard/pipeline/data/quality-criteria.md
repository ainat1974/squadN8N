# Critérios de Qualidade — N8N ERP Dashboard Squad

## Critérios de Integração de API

### Segurança
- [ ] Nenhuma credential hardcoded em qualquer arquivo ou código
- [ ] Todas as variáveis sensíveis via N8N Variables ou .env
- [ ] Token de autenticação com renovação automática antes da expiração
- [ ] Rate limiting respeitado (delay entre requisições conforme documentado)

### Completude
- [ ] Todos os 4 relatórios cobertos: Vendas, Estoque, CP, CR
- [ ] Paginação implementada para todos os endpoints paginados
- [ ] Tratamento de erros HTTP: 401, 403, 429, 500

### Documentação
- [ ] Schema JSON documentado para cada endpoint
- [ ] Exemplos de resposta com dados realistas (não vazios)

---

## Critérios de Workflow N8N

### Compatibilidade
- [ ] `typeVersion` de todos os nodes compatível com N8N v1.x LTS
- [ ] JSON do workflow válido e importável (sem erros de sintaxe)
- [ ] Cron expression correta: `0 6 * * *`

### Robustez
- [ ] Error Trigger configurado no workflow
- [ ] Todos os HTTP Request nodes com error output mapeado
- [ ] Loop de paginação completo (coleta todas as páginas)
- [ ] Workflow idempotente (sem duplicação em re-execução)

---

## Critérios de Dados

### Tipos e Formatos
- [ ] Todos os valores monetários como `number` (não string)
- [ ] Datas em ISO 8601: `YYYY-MM-DD`
- [ ] IDs como `string` (nunca assumir numérico sequencial)
- [ ] Nulos tratados com valor padrão definido

### KPIs
- [ ] Receita Total calculada e disponível
- [ ] Ticket Médio calculado
- [ ] Saldo Líquido CP vs CR calculado
- [ ] Variação percentual vs. período anterior calculada

---

## Critérios de Design

### Acessibilidade (WCAG AA)
- [ ] Contraste mínimo 4.5:1 para texto sobre fundo
- [ ] Contraste mínimo 3:1 para elementos UI (botões, bordas)
- [ ] Não depender apenas de cor para transmitir informação

### Responsividade
- [ ] Funcional em desktop (≥1280px)
- [ ] Funcional em laptop (≥1024px)
- [ ] Funcional em tablet (≥768px)

---

## Critérios de Código

### Versões (BLOQUEANTE se não atendido)
- [ ] Node.js: `>=22.0.0` (LTS)
- [ ] React: `^18.2.0` (stable)
- [ ] Express: `^4.18.2` (stable)
- [ ] Chart.js: `^4.4.x` (stable)
- [ ] Vite: `^5.x` (stable)
- [ ] Tailwind CSS: `^3.4.x` (stable)
- [ ] React Router: `^6.22.x` (stable)

### Segurança
- [ ] helmet instalado e configurado no Express
- [ ] CORS com origin específico (não `*` em produção)
- [ ] .env.example com todas as variáveis documentadas

### Qualidade
- [ ] Sem console.log em código de produção
- [ ] Tratamento de loading em todos os componentes com fetch
- [ ] Tratamento de erro com fallback visual
- [ ] Estado vazio (empty state) para listas sem dados
- [ ] Formatação monetária pt-BR em todos os valores numéricos
