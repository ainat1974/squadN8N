---
task: "Projetar Arquitetura do Workflow N8N"
order: 1
input: |
  - api_documentation: Documentação completa da API Dapic (endpoints, auth, schemas)
output: |
  - workflow_architecture: Diagrama e descrição da arquitetura do workflow
---

# Projetar Arquitetura do Workflow N8N

Define a arquitetura completa do workflow N8N antes de gerar o JSON, garantindo que todos os requisitos de coleta, autenticação, paginação, tratamento de erros e armazenamento sejam endereçados.

## Process

1. **Analisar documentação da API**: Revisar endpoints, autenticação, rate limits e schemas fornecidos pelo Artur API
2. **Definir estrutura de nodes**: Mapear cada node necessário — Cron, HTTP Request (auth), HTTP Request (dados), Function (transformação), IF (paginação), Wait, Error Trigger
3. **Projetar fluxo de autenticação**: Sequência de obtenção e renovação do token antes das chamadas de dados
4. **Projetar loop de paginação**: Se a API pagina, definir o loop com Split/Merge ou loop via Function node
5. **Projetar armazenamento**: Definir onde e como os dados coletados serão salvos (arquivo JSON, banco SQLite, ou Write Binary File)

## Output Format

```markdown
# Arquitetura do Workflow N8N — ERP Dapic

## Visão Geral
[Descrição do fluxo em linguagem natural]

## Diagrama de Fluxo
```
[Cron Trigger]
    ↓
[HTTP: Obter Token] → [Function: Extrair Token]
    ↓
[HTTP: Vendas P1] → [IF: Tem mais páginas?]
    ↓ Sim                    ↓ Não
[Wait 1s]            [HTTP: Estoque]
[HTTP: Vendas P2]         ...
    ...
```

## Nodes Necessários
| Node | Tipo N8N | Função |
|---|---|---|
| Cron Diário | Schedule Trigger | Disparar às 06:00 |
| Obter Token | HTTP Request | POST /auth/token |
...

## Estratégia de Armazenamento
[Onde os dados ficam após coleta]

## Tratamento de Erros
[Como erros são capturados e notificados]
```

## Output Example

```markdown
# Arquitetura do Workflow N8N — ERP Dapic v2.1

## Visão Geral
O workflow é disparado diariamente às 06:00 via Cron. Primeiro obtém um token JWT da API Dapic. Em seguida, para cada relatório (Vendas, Estoque, CP, CR), faz requisições HTTP com paginação automática, coletando todos os registros. Os dados são transformados em JSON normalizado e salvos em arquivos separados por data na pasta `/data/erp/YYYY-MM-DD/`. Em caso de erro, um webhook notifica o time via Slack.

## Diagrama de Fluxo
```
[Cron: 06:00 diário]
    ↓
[HTTP POST: /auth/token] ──erro──→ [Error: Alerta Slack]
    ↓
[Function: Extrair access_token]
    ↓
┌─────────────────────────────────────┐
│ LOOP: Vendas (paginação)            │
│  [HTTP GET: /vendas?page=N]         │
│  [IF: meta.page < meta.total_pages] │
│  [Wait: 1000ms]                     │
│  [HTTP GET: /vendas?page=N+1]       │
└─────────────────────────────────────┘
    ↓
[Merge: Todos os dados de Vendas]
    ↓
[HTTP GET: /estoque] (sem paginação)
    ↓
[HTTP GET: /contas-pagar] (paginado)
    ↓
[HTTP GET: /contas-receber] (paginado)
    ↓
[Function: Normalizar todos os dados]
    ↓
[Write File: /data/erp/2024-01-15/vendas.json]
[Write File: /data/erp/2024-01-15/estoque.json]
[Write File: /data/erp/2024-01-15/contas-pagar.json]
[Write File: /data/erp/2024-01-15/contas-receber.json]
    ↓
[HTTP POST: Webhook sucesso]
```

## Nodes — Total: 18 nodes
| Node | Tipo | Configuração Principal |
|---|---|---|
| Cron Diário | Schedule Trigger | Cron: `0 6 * * *` |
| Obter Token | HTTP Request | POST {{DAPIC_URL}}/auth/token |
| Extrair Token | Function | `return [{json: {token: $json.access_token}}]` |
| HTTP Vendas | HTTP Request | GET /vendas, header Bearer token |
| Loop Paginação | IF | `{{$json.meta.page}} < {{$json.meta.total_pages}}` |

## Estratégia de Armazenamento
Arquivos JSON por data: `/data/erp/{{$now.format('YYYY-MM-DD')}}/[relatorio].json`
Vantagens: simples, sem dependência de banco, leitura direta pelo dashboard backend
```

## Quality Criteria

- [ ] Todos os 4 relatórios cobertos na arquitetura
- [ ] Fluxo de autenticação com renovação de token definido
- [ ] Loop de paginação especificado para endpoints que paginar
- [ ] Estratégia de armazenamento definida
- [ ] Tratamento de erro com notificação especificado
- [ ] Diagrama de fluxo legível e completo

## Veto Conditions

Rejeitar e refazer se:
1. Algum relatório (Vendas, Estoque, CP, CR) não aparece no diagrama
2. Não há tratamento de erro definido para falhas de HTTP
