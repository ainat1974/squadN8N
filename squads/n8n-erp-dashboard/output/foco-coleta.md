# Planejamento de Coleta de Dados — ERP Dapic

> Atualizado em: 2026-05-26 — escopo reduzido para entrega incremental.
> Snapshot anterior (visão completa com Estoque + CP + CR + Fluxo de Caixa) está versionado no histórico do Git.

---

## Escopo atual (V2)

**Objetivo:** entregar um relatório diário enxuto com **todas as vendas PDV de D-1** (dia anterior) listando produtos vendidos com quantidade e valor.

| Item | Valor |
|------|-------|
| Janela | **D-1** (dia anterior, fechado) |
| Canal | **PDV** apenas (`/v1/vendaspdv/produtos`) |
| Frequência | Cron 06:00 (America/Sao_Paulo) + Webhook manual |
| Persistência | Static Data do workflow (até 120 dias de histórico) |
| Consumo | `GET /webhook/erp?modulo=resumo|vendas[&dias=N]` |

> Os módulos Estoque, Contas a Pagar, Contas a Receber e Fluxo de Caixa estão temporariamente fora do escopo. Serão reativados em iterações seguintes — a estrutura do static data e da API foram mantidas compatíveis.

---

## Endpoints utilizados

| Módulo | Endpoint | Método | Parâmetros | Paginado |
|--------|----------|--------|-----------|----------|
| Auth | `/autenticacao/v1/login` | POST | `Empresa`, `TokenIntegracao` | — |
| Vendas | `/v1/vendaspdv/produtos` | GET | `DataInicial`, `DataFinal`, `FiltrarPor=0`, `Status=1` | sim (200/pág) |

---

## Saída — payload do snapshot (`modulo=vendas`)

```json
{
  "success": true,
  "atualizadoEm": "2026-05-26T09:00:12.345Z",
  "data": "2026-05-25",
  "dados": {
    "gerado_em": "2026-05-26T09:00:12.345Z",
    "janela": "D-1",
    "periodo": { "inicio": "2026-05-25", "fim": "2026-05-25", "dias": 1 },
    "summary": {
      "receita_total": 12480.50,
      "volume_vendas": 87,
      "ticket_medio": 143.45,
      "total_itens": 215,
      "total_skus": 42,
      "receita_pdv": 12480.50,
      "receita_b2b": 0
    },
    "evolucao_diaria": [
      { "data": "2026-05-25", "receita": 12480.50, "volume": 87 }
    ],
    "produtos_vendidos": [
      {
        "codigo": "TM-0123",
        "produto": "Camiseta Básica Branca M",
        "quantidade": 18,
        "valor_unitario_medio": 49.90,
        "valor_total": 898.20
      }
    ],
    "top_produtos": [ /* top 10 do array acima */ ],
    "top_clientes": [],
    "por_representante": []
  }
}
```

### Resumo (`modulo=resumo`)

```json
{
  "success": true,
  "atualizadoEm": "2026-05-26T09:00:12.345Z",
  "data": "2026-05-25",
  "dataExecucao": "2026-05-26",
  "janelaColeta": "D-1",
  "periodo": { "inicio": "2026-05-25", "fim": "2026-05-25", "dias": 1 },
  "receita_total": 12480.50,
  "volume_vendas": 87,
  "ticket_medio": 143.45,
  "total_itens": 215,
  "total_skus": 42,
  "receita_pdv": 12480.50,
  "receita_b2b": 0
}
```

---

## Variáveis necessárias no n8n (Settings → Variables)

| Nome | Valor |
|------|-------|
| `DAPIC_EMPRESA` | `techmalhasfranca` |
| `DAPIC_TOKEN_INTEGRACAO` | *(token de integração — confidencial)* |

---

## Triggers

- **Cron Diário 06:00** — `0 6 * * *` (timezone do workflow: `America/Sao_Paulo`).
- **Webhook Manual** — `POST /webhook/atualizar` (acionado pelo botão *Atualizar* do dashboard).

## Webhook de leitura

- `GET /webhook/erp?modulo=resumo` — sumário do D-1.
- `GET /webhook/erp?modulo=vendas` — relatório completo do D-1.
- `GET /webhook/erp?modulo=vendas&dias=N` — agrega N dias do histórico (1–120).

---

## Robustez

- Paginação com `RegistrosPorPagina=200` e backoff exponencial (1s → 2s → 4s) em `429` e `5xx`.
- Renovação automática do token em `401` (uma única retentativa por chamada).
- `Error Trigger` aciona webhook `/alerta-erro` com mensagem + timestamp.
- Static data mantém até 120 dias de histórico diário (rotação automática).

---

## Próximos passos sugeridos

1. Reativar coleta de **Estoque** (saldo + reposição) reutilizando os mesmos blocos de auth/contexto.
2. Reativar **Contas a Pagar** e **Contas a Receber**.
3. Reintroduzir o **Fluxo de Caixa** projetado por semana.
