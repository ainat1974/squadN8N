---
task: "Definir Schema e Estratégia de Armazenamento"
order: 3
input: |
  - transformation_spec: Especificação de transformações
  - data_analysis: Análise dos dados brutos
output: |
  - data_schema: Schema completo de saída + estratégia de armazenamento para o dashboard
---

# Definir Schema e Estratégia de Armazenamento

Define o schema final dos dados transformados e a estratégia de armazenamento que alimentará o dashboard web.

## Process

1. **Definir schema JSON de saída**: Estrutura exata dos arquivos de dados que o dashboard vai ler
2. **Definir estrutura de diretórios**: Como os arquivos são organizados por data e tipo
3. **Definir endpoint da API backend**: Como o backend Node.js serve esses dados ao frontend React
4. **Definir estratégia de retenção**: Quantos dias de histórico manter, política de limpeza
5. **Documentar schema completo**: Arquivo `data-schema.md` com tudo que o Fábio Frontend precisa saber

## Output Format

```markdown
# Schema de Dados — ERP Dapic Dashboard

## Estrutura de Diretórios
```
/data/erp/
  2024-01-15/
    vendas.json
    estoque.json
    contas-pagar.json
    contas-receber.json
  2024-01-14/
    ...
  latest/   ← symlink para data mais recente
    vendas.json
    ...
```

## Schema: vendas.json
```json
{
  "date": "YYYY-MM-DD",
  "summary": {
    "total_vendas": number,
    "receita_total": number,
    "ticket_medio": number,
    "variacao_percentual": number
  },
  "por_dia": [
    { "data": "YYYY-MM-DD", "receita": number, "quantidade": number }
  ],
  "top_produtos": [...],
  "raw_count": number
}
```

## API Backend — Endpoints
GET /api/dashboard/vendas?period=30d
GET /api/dashboard/estoque
GET /api/dashboard/contas-pagar?status=pendente
GET /api/dashboard/contas-receber?status=pendente
GET /api/dashboard/resumo (todos os KPIs em um request)

## Estratégia de Retenção
- Manter 90 dias de histórico
- Limpeza automática via N8N (cron semanal)
```

## Output Example

```markdown
# Schema Completo de Dados — ERP Dapic Dashboard

## Estrutura de Diretórios
```
data/erp/
├── 2024-01-15/
│   ├── vendas.json          # Dados de vendas transformados
│   ├── estoque.json         # Posição de estoque
│   ├── contas-pagar.json    # CP com status e vencimentos
│   └── contas-receber.json  # CR com status e vencimentos
├── 2024-01-14/
│   └── ...
└── latest -> 2024-01-15/   # Link simbólico para data mais recente
```

## Schema: vendas.json
```json
{
  "date": "2024-01-15",
  "collected_at": "2024-01-15T06:05:23Z",
  "summary": {
    "total_vendas": 247,
    "receita_total": 185420.50,
    "ticket_medio": 750.28,
    "variacao_receita_dia_anterior": 12.5
  },
  "serie_temporal": [
    { "data": "2024-01-15", "receita": 185420.50, "quantidade": 247 },
    { "data": "2024-01-14", "receita": 164818.22, "quantidade": 231 }
  ],
  "top_5_produtos": [
    { "produto_id": "PRD-001", "descricao": "Produto A", "receita": 45000.00, "quantidade": 300 }
  ]
}
```

## Schema: contas-pagar.json
```json
{
  "date": "2024-01-15",
  "summary": {
    "total_pendente": 45230.00,
    "total_vencido": 8100.00,
    "quantidade_pendente": 12,
    "quantidade_vencido": 3
  },
  "vencimentos_proximos": [
    {
      "id": "CP-001",
      "fornecedor": "Fornecedor X",
      "valor": 5000.00,
      "vencimento": "2024-01-18",
      "dias_para_vencer": 3,
      "status": "pendente"
    }
  ]
}
```

## API Backend — Endpoints do Node.js
| Método | Rota | Descrição | Parâmetros |
|---|---|---|---|
| GET | `/api/dashboard/resumo` | KPIs consolidados | `?date=YYYY-MM-DD` |
| GET | `/api/dashboard/vendas` | Dados de vendas | `?period=7d\|30d\|90d` |
| GET | `/api/dashboard/estoque` | Posição de estoque | `?date=YYYY-MM-DD` |
| GET | `/api/dashboard/contas-pagar` | CP por status | `?status=pendente\|vencido\|pago` |
| GET | `/api/dashboard/contas-receber` | CR por status | `?status=pendente\|vencido\|recebido` |

## Estratégia de Retenção
- **Período**: 90 dias de histórico
- **Limpeza**: Workflow N8N separado, todo domingo às 02:00, remove pastas > 90 dias
- **Backup**: Manter 1 snapshot por mês indefinidamente (primeiro dia do mês)
```

## Quality Criteria

- [ ] Schema JSON de saída definido para todos os 4 relatórios
- [ ] Estrutura de diretórios documentada
- [ ] Endpoints da API backend especificados com método, rota e parâmetros
- [ ] Estratégia de retenção de dados definida
- [ ] Documento suficientemente detalhado para o Fábio Frontend implementar sem dúvidas

## Veto Conditions

Rejeitar e refazer se:
1. Schema de saída incompleto — algum dos 4 relatórios sem schema definido
2. Endpoints da API backend não especificados (Fábio Frontend precisa dessa informação)
