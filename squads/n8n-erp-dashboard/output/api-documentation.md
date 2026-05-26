# Documentação Técnica de Integração — API Dapic ERP
> Gerado por: Artur API 🔍 | Data: 2026-05-25
> Input: `foco-coleta.md` + `dapic-api.md`
> Output para: Nelson N8N (Step 3)

---

## 1. Configuração de Autenticação

### Endpoint
```
POST https://api.dapic.app/autenticacao/v1/login
Content-Type: application/json
```

### Payload
```json
{
  "Empresa": "{{DAPIC_EMPRESA}}",
  "TokenIntegracao": "{{DAPIC_TOKEN_INTEGRACAO}}"
}
```

### Response
```json
{
  "access_token": "eyJhbGci...<JWT>",
  "expires_in": "86400",
  "token_type": "Bearer"
}
```

### Estratégia no Workflow N8N
- **1 request de autenticação por execução** — no início do workflow
- Salvar `access_token` em variável de contexto N8N: `{{$workflow.variables.dapic_token}}`
- Reutilizar em TODOS os nodes subsequentes via header: `Authorization: Bearer {{$workflow.variables.dapic_token}}`
- Em caso de HTTP 401 em qualquer node: retry imediato do auth + retry do request original (max 1x)

### Credenciais N8N (configurar antes de ativar)
| Variável N8N | Valor |
|---|---|
| `DAPIC_EMPRESA` | `techmalhasfranca` |
| `DAPIC_TOKEN_INTEGRACAO` | *(valor em credentials.md — nunca hardcode)* |

---

## 2. Módulo Vendas — Endpoints

### 2.1 Pedidos de Venda (B2B / Representantes)
```
GET https://api.dapic.app/v1/pedidosvendas
Authorization: Bearer {{token}}
```

**Query Params obrigatórios:**
| Param | Tipo | Valor para Dashboard |
|-------|------|---------------------|
| `DataInicial` | YYYY-MM-DD | Início do período (ex: primeiro dia do mês) |
| `DataFinal` | YYYY-MM-DD | Hoje |
| `Status` | int | `5` (Faturado) — apenas pedidos confirmados |
| `FiltrarPor` | int | `0` (Data emissão) |
| `RegistroPorPagina` | int | `200` (máximo) |
| `Pagina` | int | Incrementar até `TotalPaginas` |

**Response Schema (campos utilizados):**
```json
{
  "Dados": [
    {
      "Id": 42655,
      "Status": "Faturado",
      "Codigo": "PV240101001",
      "DataEmissao": "2024-01-01T00:00:00",
      "DataFechamento": "2024-01-03T00:00:00",
      "Cliente": "Tech Malhas Ltda",
      "ValorLiquido": 1500.00
    }
  ],
  "Pagina": 1,
  "RegistrosPorPagina": 200,
  "TotalPaginas": 3
}
```

**KPIs extraídos:** Receita (ValorLiquido), Volume (count), Cliente, Data (para evolução diária), Canal=B2B

---

### 2.2 Vendas PDV (Ponto de Venda / Caixa)
```
GET https://api.dapic.app/v1/vendas
Authorization: Bearer {{token}}
```

**Query Params:** Mesmos do endpoint anterior (DataInicial, DataFinal, Status=5, RegistroPorPagina=200, Pagina)

**Response Schema (campos utilizados):** Idêntico à estrutura de pedidosvendas
**KPIs extraídos:** Receita, Volume, Data — Canal=PDV

---

### 2.3 Produtos Vendidos — Consolidado (Top Produtos)
```
GET https://api.dapic.app/v1/vendas/produtosvendidos
Authorization: Bearer {{token}}
```

**Query Params:** `DataInicial`, `DataFinal`, `RegistroPorPagina=200`, `Pagina`

**KPIs extraídos:** Produto, Quantidade, ValorTotal — para ranking Top 10 produtos

---

## 3. Módulo Estoque — Endpoints

### 3.1 Saldo Atual (Todos os Armazenadores)
```
GET https://api.dapic.app/v1/estoques/todos
Authorization: Bearer {{token}}
```

**Query Params:** `RegistroPorPagina=200`, `Pagina`

**Response Schema:**
```json
{
  "Dados": [
    {
      "Id": 1,
      "Produto": "Camiseta P Branca",
      "CodigoProduto": "CAM-P-BRA",
      "Armazenador": "Almoxarifado Principal",
      "Quantidade": 45,
      "ValorUnitario": 28.50
    }
  ],
  "TotalPaginas": 2
}
```

**KPIs extraídos:** Quantidade atual por produto, ValorUnitario (para cálculo de valor total em estoque)

---

### 3.2 Movimentações de Estoque (Últimos 30 dias)
```
GET https://api.dapic.app/v1/movimentacoesestoque
Authorization: Bearer {{token}}
```

**⚠️ RESTRIÇÃO CRÍTICA:** Máximo 31 dias por request. Para 90 dias: 3 requests paralelos.

**Query Params obrigatórios:**
| Param | Tipo | Valor |
|-------|------|-------|
| `DataInicial` | YYYY-MM-DD | Hoje - 30 dias |
| `DataFinal` | YYYY-MM-DD | Hoje |
| `RegistrosPorPagina` | int | `200` |
| `Pagina` | int | Paginar até TotalPaginas |

**⚠️ RISCO DE 429:** Endpoint volumoso — aguardar 2s antes de chamar após outros requests.

**KPIs extraídos:** Volume movimentado por produto por dia (para cálculo de Venda Média Diária e Tendência Semanal)

---

## 4. Módulo Financeiro — Endpoints

### 4.1 Parcelas (Contas a Pagar e Receber)
```
GET https://api.dapic.app/v1/contas/parcelas
Authorization: Bearer {{token}}
```

**Query Params:**
| Param | Valor CP | Valor CR |
|-------|----------|----------|
| `DataInicial` | Hoje - 90 dias | Hoje - 90 dias |
| `DataFinal` | Hoje + 30 dias | Hoje + 30 dias |
| `FiltrarPor` | 0 (vencimento) | 0 (vencimento) |
| `RegistrosPorPagina` | 200 | 200 |

**⚠️ NOTA:** O endpoint retorna tanto CP quanto CR. Filtrar no N8N pelo campo `Tipo` ou campo equivalente indicando se é pagamento ou recebimento.

**Response Schema (campos utilizados):**
```json
{
  "Dados": [
    {
      "Id": 1001,
      "Descricao": "Fornecedor XYZ",
      "DataVencimento": "2026-06-10T00:00:00",
      "Valor": 850.00,
      "Status": "Pendente",
      "Tipo": "Pagar"
    }
  ],
  "TotalPaginas": 4
}
```

**KPIs extraídos:**
- **CP:** Total pendente, vencidos (DataVencimento < hoje AND Status ≠ Pago), vencendo em 7d
- **CR:** Total pendente, inadimplentes (DataVencimento < hoje AND Status ≠ Recebido), recebendo em 7d
- **Ambos:** Agrupamento por semana para fluxo de caixa projetado (próximas 4 semanas)

---

### 4.2 Pagamentos Realizados
```
GET https://api.dapic.app/v1/contas/pagamentos
Authorization: Bearer {{token}}
```

**Query Params:** `DataInicial` (primeiro dia do mês), `DataFinal` (hoje), `RegistrosPorPagina=200`, `Pagina`

**KPIs extraídos:** Pagamentos efetivados no período (para confrontar com pendentes)

---

## 5. Estratégia de Paginação

### Loop Padrão (todos os endpoints paginados)
```
Algoritmo:
  pagina = 1
  todos_dados = []
  
  LOOP:
    response = GET endpoint?Pagina={pagina}&RegistroPorPagina=200
    todos_dados += response.Dados
    
    SE pagina >= response.TotalPaginas: BREAK
    pagina++
    WAIT 650ms  ← respeitar rate limit (100 req/min = ~600ms entre requests)
```

### Implementação N8N
- **Split In Batches** não é suficiente — usar **Function node** com loop manual ou **Loop node** do N8N
- Alternativa: **HTTP Request node** com paginação automática (se disponível na versão instalada)
- Armazenar dados acumulados em variável de workflow entre iterações

---

## 6. Rate Limiting e Retry

| Situação | Ação |
|----------|------|
| Entre requests paginados | WAIT 650ms (garante < 100 req/min) |
| Antes de `/movimentacoesestoque` | WAIT 2000ms (endpoint volumoso, risco de 429) |
| HTTP 429 recebido | WAIT 60s + retry (max 3x com backoff exponencial: 60s, 120s, 240s) |
| HTTP 401 recebido | Renovar token + retry imediato (1x apenas) |
| HTTP 500/503 | WAIT 30s + retry (max 2x) |
| Falha persistente (> max retries) | Notificar via webhook de alerta + encerrar execução |

---

## 7. Estrutura de Saída dos JSONs

### `/data/erp/YYYY-MM-DD/vendas.json`
```json
{
  "gerado_em": "2026-05-25T06:00:00",
  "periodo": { "inicio": "2026-04-25", "fim": "2026-05-25" },
  "summary": {
    "receita_total": 0,
    "volume_vendas": 0,
    "ticket_medio": 0,
    "variacao_mes_anterior_pct": 0,
    "receita_b2b": 0,
    "receita_pdv": 0
  },
  "evolucao_diaria": [
    { "data": "2026-05-01", "receita": 0, "volume": 0 }
  ],
  "top_produtos": [
    { "produto": "", "receita": 0, "quantidade": 0 }
  ],
  "top_clientes": [
    { "cliente": "", "receita": 0, "volume": 0 }
  ],
  "por_representante": [
    { "representante": "", "receita": 0, "pedidos": 0, "ticket_medio": 0 }
  ]
}
```

### `/data/erp/YYYY-MM-DD/estoque.json`
```json
{
  "gerado_em": "2026-05-25T06:00:00",
  "summary": {
    "valor_total_estoque": 0,
    "skus_criticos": 0,
    "skus_alerta": 0,
    "giro_estoque_30d": 0
  },
  "saldo_dia": [
    { "produto": "", "codigo": "", "estoque_atual": 0, "vendas_hoje": 0, "saldo": 0, "status": "OK" }
  ],
  "reposicao_urgente": [
    { "produto": "", "estoque_atual": 0, "venda_media_diaria": 0, "dias_ate_zerar": 0, "urgencia": "CRITICO" }
  ],
  "tendencia_semanal": [
    { "produto": "", "vendas_semana_atual": 0, "vendas_semana_anterior": 0, "variacao_pct": 0, "tendencia": "subindo" }
  ]
}
```

### `/data/erp/YYYY-MM-DD/contas-pagar.json`
```json
{
  "gerado_em": "2026-05-25T06:00:00",
  "summary": {
    "total_pendente": 0,
    "total_vencido": 0,
    "total_vencendo_7d": 0
  },
  "vencidos": [
    { "id": 0, "descricao": "", "valor": 0, "data_vencimento": "", "dias_atraso": 0 }
  ],
  "vencendo_7d": [
    { "id": 0, "descricao": "", "valor": 0, "data_vencimento": "" }
  ],
  "fluxo_semanal": [
    { "semana": "2026-W22", "total_saidas": 0 }
  ]
}
```

### `/data/erp/YYYY-MM-DD/contas-receber.json`
```json
{
  "gerado_em": "2026-05-25T06:00:00",
  "summary": {
    "total_pendente": 0,
    "total_inadimplente": 0,
    "total_recebendo_7d": 0,
    "saldo_liquido": 0
  },
  "inadimplentes": [
    { "id": 0, "cliente": "", "valor": 0, "data_vencimento": "", "dias_atraso": 0 }
  ],
  "recebendo_7d": [
    { "id": 0, "cliente": "", "valor": 0, "data_vencimento": "" }
  ],
  "fluxo_semanal": [
    { "semana": "2026-W22", "total_entradas": 0 }
  ]
}
```

### `/data/erp/YYYY-MM-DD/fluxo-caixa.json`
```json
{
  "gerado_em": "2026-05-25T06:00:00",
  "saldo_liquido_atual": 0,
  "projecao_4_semanas": [
    {
      "semana": "2026-W22",
      "entradas_previstas": 0,
      "saidas_previstas": 0,
      "saldo_semana": 0,
      "saldo_acumulado": 0
    }
  ]
}
```

---

## 8. Checklist de Validação (Artur API)

- [x] Autenticação documentada com exemplo de request/response
- [x] 8 endpoints mapeados com params obrigatórios e opcionais
- [x] Schema de response documentado para cada endpoint
- [x] Rate limit (100 req/min) → wait 650ms entre requests
- [x] Restrição movimentações estoque (max 31d) → documentada
- [x] Estratégia de paginação (loop até TotalPaginas)
- [x] Estratégia de retry (401→renovar token, 429→backoff exponencial)
- [x] Schema de saída dos 5 JSONs definido
- [x] Credenciais via variáveis (sem hardcode)
