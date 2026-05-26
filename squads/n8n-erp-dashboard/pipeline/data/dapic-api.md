# Documentação da API Dapic — ERP de Confecção Têxtil

> Fonte: https://docs.dapic.app/  
> Data de referência: 2026-05-25  
> **IMPORTANTE: A API é somente leitura — não permite inclusão ou modificação de dados, com exceção do endpoint de inclusão de pedido de venda simples.**

---

## Informações Gerais

| Campo | Valor |
|-------|-------|
| **Base URL** | `https://api.dapic.app` |
| **Autenticação** | Bearer Token (JWT) — header `Authorization: Bearer <token>` |
| **Formato** | JSON (request & response) |
| **Rate Limit** | 100 requisições/minuto por endpoint |
| **Token TTL** | 86400 segundos (1 dia) |
| **Versão** | v1 |

---

## Regras Globais

### Paginação
- Parâmetros: `Pagina` (padrão: 1) e `RegistrosPorPagina` (padrão: 10, máx: 200)
- Response sempre inclui: `Dados[]`, `Pagina`, `RegistrosPorPagina`, `TotalPaginas`

### Ordenação
- `OrdenarPor` — campo de ordenação (valores variam por endpoint)
- `TipoOrdenacao` — `0` = Decrescente, `1` = Crescente

### Endpoints Volumosos (NF-e, NFC-e, Movimentações de Estoque, Objetos de Postagem)
- Exigem `DataInicial` e `DataFinal` obrigatórios
- Intervalo máximo: **31 dias**
- Podem retornar HTTP 429 por concorrência excessiva

---

## 1. Autenticação

### POST — Obter access_token
```
POST https://api.dapic.app/autenticacao/v1/login
Content-Type: application/json
```

**Body:**
```json
{
  "Empresa": "{{identificador_da_empresa}}",
  "TokenIntegracao": "{{token_de_integracao_gerado_no_dapic}}"
}
```
> O `TokenIntegracao` é gerado em: https://dapic.app/admin/empresa

**Response 200:**
```json
{
  "access_token": "eyJhbGci...",
  "expires_in": "86400",
  "token_type": "Bearer"
}
```

**Estratégia recomendada:** Armazenar o token e reutilizá-lo enquanto válido (1 dia). Renová-lo apenas quando expirar (HTTP 401).

---

## 2. Pedidos de Vendas

### GET — Listar pedidos de vendas
```
GET https://api.dapic.app/v1/pedidosvendas
Authorization: Bearer <token>
```

**Query Params:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `DataInicial` | date (YYYY-MM-DD) | Data inicial do período |
| `DataFinal` | date (YYYY-MM-DD) | Data final do período |
| `FiltrarPor` | int | 0=Data emissão, 2=Data fechamento, 3=Data modificação |
| `OrdenarPor` | int | 0=Data emissão, 1=ID, 2=Cliente, 3=Código, 4=Cód.externo, 5=Valor líquido, 6=Status, 7=Data modificação |
| `TipoOrdenacao` | int | 0=Decrescente, 1=Crescente |
| `Status` | int | 0=Aberto, 4=Cancelado, 5=Faturado |
| `Pagina` | int | Página atual (padrão: 1) |
| `RegistroPorPagina` | int | Registros por página (padrão: 10) |

**Exemplo curl:**
```bash
curl --location 'https://api.dapic.app/v1/pedidosvendas?DataInicial=2024-01-01&DataFinal=2024-01-31' \
  --header 'Authorization: Bearer <token>'
```

**Response 200:**
```json
{
  "Dados": [
    {
      "Id": 42655,
      "Status": "Aberto",
      "Codigo": "PV240101001",
      "CodigoExterno": null,
      "DataEmissao": "2024-01-01T00:00:00",
      "DataFechamento": null,
      "Cliente": "João da Silva",
      "ValorLiquido": 500.00
    }
  ],
  "Pagina": 1,
  "RegistrosPorPagina": 10,
  "TotalPaginas": 5
}
```

---

### GET — Obter pedido de venda (detalhado)
```
GET https://api.dapic.app/v1/pedidosvendas/{id_pedido_venda}
Authorization: Bearer <token>
```
Retorna detalhes completos: produtos, valores, cliente, endereço, fechamento.

---

### GET — Listar produtos do pedido de venda
```
GET https://api.dapic.app/v1/pedidosvendas/{id_pedido_venda}/produtos
Authorization: Bearer <token>
```

**Query Params:** `Pagina`, `RegistrosPorPagina`

Retorna: detalhes dos produtos, ficha técnica com operações e consumos, comprometimentos, grade e valores.

---

### POST — Incluir pedido de venda simples
```
POST https://api.dapic.app/v1/pedidosvendassimples
Authorization: Bearer <token>
Content-Type: application/json
```

**Body exemplo:**
```json
{
  "Codigo": "1023",
  "IdConfiguracaoWebService": 4,
  "Data": "2025-08-11T19:53:09",
  "ValorFrete": 37.46,
  "ServicoFrete": "Normal",
  "Desconto": 0,
  "Acrescimo": 0,
  "IdTabelaPreco": 137,
  "Cliente": {
    "RazaoSocial": "Nome do Cliente",
    "TipoPessoa": 0,
    "CpfCnpj": "00000000000",
    "Telefone": "(11)99999-9999",
    "Email": "cliente@email.com"
  },
  "Endereco": {
    "Logradouro": "Rua Exemplo",
    "Numero": "100",
    "Bairro": "Centro",
    "Cidade": "São Paulo",
    "Estado": "SP",
    "Cep": "01000-000"
  },
  "Pagamentos": [
    {
      "FormaPagamento": "CARTAO - VISA",
      "Parcelas": "1",
      "ValorPago": 500.00,
      "DataPagamento": "2025-08-11T19:53:09"
    }
  ],
  "Produtos": [
    {
      "Codigo": "78357321",
      "Quantidade": 1,
      "Valor": 500.00
    }
  ]
}
```

---

## 3. Faturas

### GET — Listar faturas
```
GET https://api.dapic.app/v1/faturas
Authorization: Bearer <token>
```

**Query Params:** `DataInicial`, `DataFinal`, `FiltrarPor`, `OrdenarPor`, `TipoOrdenacao`, `Status`, `Pagina`, `RegistrosPorPagina`

---

### GET — Obter fatura (detalhada)
```
GET https://api.dapic.app/v1/faturas/{id_fatura}
Authorization: Bearer <token>
```

---

### GET — Listar produtos da fatura
```
GET https://api.dapic.app/v1/faturas/{id_fatura}/produtos
Authorization: Bearer <token>
```

---

## 4. Vendas do PDV (Ponto de Venda)

### GET — Listar vendas PDV
```
GET https://api.dapic.app/v1/vendas
Authorization: Bearer <token>
```

**Query Params:** `DataInicial`, `DataFinal`, `FiltrarPor`, `OrdenarPor`, `TipoOrdenacao`, `Status`, `Pagina`, `RegistrosPorPagina`

---

### GET — Obter venda do PDV
```
GET https://api.dapic.app/v1/vendas/{id_venda}
Authorization: Bearer <token>
```

---

### GET — Listar produtos da venda PDV
```
GET https://api.dapic.app/v1/vendas/{id_venda}/produtos
Authorization: Bearer <token>
```

---

### GET — Listar produtos vendidos (consolidado)
```
GET https://api.dapic.app/v1/vendas/produtosvendidos
Authorization: Bearer <token>
```

---

## 5. Estoques

### GET — Listar armazenadores de estoque
```
GET https://api.dapic.app/v1/estoques
Authorization: Bearer <token>
```

---

### GET — Obter armazenador de estoque
```
GET https://api.dapic.app/v1/estoques/{id_armazenador}
Authorization: Bearer <token>
```

---

### GET — Listar produtos do armazenador de estoque
```
GET https://api.dapic.app/v1/estoques/{id_armazenador}/produtos
Authorization: Bearer <token>
```

**Query Params:** `Pagina`, `RegistrosPorPagina`

---

### GET — Listar todos os estoques (consolidado)
```
GET https://api.dapic.app/v1/estoques/todos
Authorization: Bearer <token>
```

---

## 6. Movimentações de Estoque

> ⚠️ Endpoint volumoso: exige `DataInicial` e `DataFinal` (max 31 dias). Pode retornar HTTP 429 por concorrência.

### GET — Listar movimentações de estoque
```
GET https://api.dapic.app/v1/movimentacoesestoque
Authorization: Bearer <token>
```

**Query Params obrigatórios:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `DataInicial` | date (YYYY-MM-DD) | Início do período (obrigatório) |
| `DataFinal` | date (YYYY-MM-DD) | Fim do período (obrigatório, max 31d) |

**Query Params opcionais:** `Pagina`, `RegistrosPorPagina`, `OrdenarPor`, `TipoOrdenacao`

---

## 7. Contas (Contas a Pagar e Receber)

### GET — Listar parcelas
```
GET https://api.dapic.app/v1/contas/parcelas
Authorization: Bearer <token>
```

**Query Params:** `DataInicial`, `DataFinal`, `FiltrarPor`, `Status`, `OrdenarPor`, `TipoOrdenacao`, `Pagina`, `RegistrosPorPagina`

Retorna parcelas de contas a pagar e receber com status de pagamento.

---

### GET — Listar pagamentos
```
GET https://api.dapic.app/v1/contas/pagamentos
Authorization: Bearer <token>
```

**Query Params:** `DataInicial`, `DataFinal`, `Pagina`, `RegistrosPorPagina`

---

## 8. Orçamentos

### GET — Listar orçamentos
```
GET https://api.dapic.app/v1/orcamentos
Authorization: Bearer <token>
```

**Query Params:**
| Parâmetro | Tipo | Descrição |
|-----------|------|-----------|
| `DataInicial` | date | Data inicial |
| `DataFinal` | date | Data final |
| `FiltrarPor` | int | 0=Data emissão, 2=Data fechamento, 3=Data modificação |
| `OrdenarPor` | int | 0=Emissão, 1=ID, 2=Cliente, 3=Código, 4=Cód.externo, 5=Valor líquido, 6=Status, 7=Modificação |
| `TipoOrdenacao` | int | 0=Decrescente, 1=Crescente |
| `Status` | int | 0=Aberto/Expirado, 4=Cancelado, 5=Fechado |
| `Pagina` | int | Padrão 1 |
| `RegistrosPorPagina` | int | Padrão 10 |

**Response 200:**
```json
{
  "Dados": [
    {
      "Status": "Aberto",
      "Id": 42657,
      "Codigo": "BS230112165134WR",
      "CodigoExterno": null,
      "DataEmissao": "2023-01-12T00:00:00",
      "DataFechamento": null,
      "Cliente": "João da Silva",
      "ValorLiquido": 100
    }
  ],
  "Pagina": 1,
  "RegistrosPorPagina": 10,
  "TotalPaginas": 1
}
```

---

### GET — Obter orçamento (detalhado)
```
GET https://api.dapic.app/v1/orcamentos/{id_orcamento}
Authorization: Bearer <token>
```

**Response detalhada inclui:** Cliente (Id, Nome, CpfCnpj, Telefone, Celular, Email), Endereço, Representante, TabelaPrecos, Produtos (com Cor, Tamanho, Quantidade, ValorUnitario, ValorTotal), Fechamento, Valores totais, Observações.

---

### GET — Listar produtos do orçamento
```
GET https://api.dapic.app/v1/orcamentos/{id_orcamento}/produtos
Authorization: Bearer <token>
```

**Query Params:** `Pagina`, `RegistrosPorPagina`

---

## 9. Produtos

### GET — Listar produtos
```
GET https://api.dapic.app/v1/produtos
Authorization: Bearer <token>
```

**Query Params:** `Pagina`, `RegistrosPorPagina`, `OrdenarPor`, `TipoOrdenacao`

---

### GET — Obter produto
```
GET https://api.dapic.app/v1/produtos/{id_produto}
Authorization: Bearer <token>
```

---

### Outros endpoints de produtos
| Endpoint | Descrição |
|----------|-----------|
| `GET /v1/produtos/{id}/fichatecnica` | Ficha técnica do produto |
| `GET /v1/produtos/{id}/composicoes` | Composições do produto |
| `GET /v1/produtos/{id}/localizacoes` | Localizações no estoque |
| `GET /v1/produtos/{id}/estoquesminimos` | Estoques mínimos configurados |
| `GET /v1/produtos/{id}/grades` | Grades de tamanhos do produto |
| `GET /v1/produtos/grades` | Todas as grades de todos os produtos |
| `GET /v1/produtos/{id}/conversoes` | Conversões de unidade para nota de exportação |

---

## 10. Outros Módulos Disponíveis

| Módulo | Endpoints principais |
|--------|---------------------|
| **Clientes** | Listar, Obter |
| **Grupos de clientes** | Listar |
| **Notas fiscais (NF-e)** | Listar (volumoso: max 31 dias) |
| **Notas fiscais consumidor (NFC-e)** | Listar (volumoso: max 31 dias) |
| **Consignados** | Listar, Obter |
| **Ordem de produção** | Listar, Obter |
| **Logística de entregas** | Listar |
| **Objetos de postagem** | Listar (volumoso: max 31 dias) |
| **Caixas PDV** | Listar, Obter |
| **Representantes** | Listar, Obter |
| **Funcionários** | Listar, Obter |
| **Tabelas de preços** | Listar, Obter |
| **Formas de pagamento** | Listar |
| **Planos de contas** | Listar |
| **Empresas** | Listar, Obter |

---

## Mapeamento de Relatórios → Endpoints

| Relatório do Dashboard | Endpoint Principal | Dados Complementares |
|-----------------------|-------------------|---------------------|
| **Vendas** | `GET /v1/pedidosvendas` + `GET /v1/vendas` (PDV) | `/v1/faturas` para vendas faturadas |
| **Estoque** | `GET /v1/estoques/todos` | `/v1/movimentacoesestoque` para giro |
| **Contas a Receber** | `GET /v1/contas/parcelas` (Status = a receber) | `/v1/contas/pagamentos` |
| **Contas a Pagar** | `GET /v1/contas/parcelas` (Status = a pagar) | `/v1/contas/pagamentos` |

---

## Tratamento de Erros

| HTTP Code | Significado |
|-----------|-------------|
| 200 | Sucesso |
| 401 | Token inválido ou expirado → renovar via POST /autenticacao/v1/login |
| 429 | Rate limit atingido (100 req/min) ou concorrência em endpoint volumoso → aguardar e retry |
| 404 | Recurso não encontrado |
