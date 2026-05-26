# Exemplos de Output — N8N ERP Dashboard Squad

## Exemplo 1: api-documentation.md (output do Artur API)

```markdown
# Documentação Técnica — API Dapic v2.1

## Autenticação
- **Método**: Bearer Token (JWT)
- **Endpoint**: `POST {{DAPIC_API_URL}}/api/auth/token`
- **Body**: `{"username": "{{DAPIC_USER}}", "password": "{{DAPIC_PASSWORD}}"}`
- **Resposta**: `{"access_token": "eyJ...", "expires_in": 3600}`
- **Uso**: Header `Authorization: Bearer {{access_token}}`
- **Renovação**: A cada 50 minutos (antes dos 60min de expiração)

## Endpoints

### Vendas — GET /api/v2/relatorios/vendas
**Parâmetros**: `data_inicio` (YYYY-MM-DD), `data_fim` (YYYY-MM-DD), `page` (int), `limit` (int, max 100)
**Paginação**: Sim — campo `meta.total_pages`
**Rate Limit**: 60 req/min

**Schema de Resposta**:
```json
{
  "data": [
    {
      "id": "VND-2024-001234",
      "data_venda": "15/01/2024",
      "cliente": { "id": "CLI-456", "nome": "Empresa Exemplo Ltda" },
      "valor_total": "1.425,00",
      "status": "FATURADO"
    }
  ],
  "meta": { "total": 1250, "page": 1, "per_page": 100, "total_pages": 13 }
}
```
⚠️ **Problemas identificados**:
- `data_venda` em formato DD/MM/YYYY (não ISO 8601)
- `valor_total` como string com formato pt-BR (não number)
- `status` com case inconsistente
```

---

## Exemplo 2: workflow-n8n.json (output do Nelson N8N)

```json
{
  "name": "ERP Dapic — Coleta Diária",
  "nodes": [
    {
      "id": "node-001",
      "name": "Cron Diário 06h",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [200, 300],
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 6 * * *" }]
        }
      }
    },
    {
      "id": "node-002",
      "name": "Obter Token Dapic",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 300],
      "parameters": {
        "method": "POST",
        "url": "={{ $vars.DAPIC_API_URL }}/api/auth/token",
        "sendBody": true,
        "body": { "username": "={{ $vars.DAPIC_USER }}", "password": "={{ $vars.DAPIC_PASSWORD }}" }
      },
      "onError": "continueErrorOutput"
    }
  ],
  "connections": {
    "Cron Diário 06h": { "main": [[{ "node": "Obter Token Dapic", "type": "main", "index": 0 }]] },
    "Obter Token Dapic": {
      "main": [[{ "node": "Extrair Token", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Alerta Falha Auth", "type": "main", "index": 0 }]]
    }
  },
  "settings": { "executionOrder": "v1", "saveManualExecutions": true },
  "tags": ["erp", "dapic", "coleta-dados", "producao"]
}
```

---

## Exemplo 3: vendas.json (output do Dante Dados após transformação)

```json
{
  "date": "2024-01-15",
  "collected_at": "2024-01-15T06:05:23Z",
  "summary": {
    "total_vendas": 247,
    "receita_total": 185420.50,
    "ticket_medio": 750.28,
    "variacao_receita_pct": 12.5,
    "variacao_volume_pct": 6.9
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

---

## Exemplo 4: quality-report.md (output da Renata Revisão)

```markdown
# Relatório Final de Qualidade — N8N ERP Dashboard Squad
**Data**: 2024-01-15 | **Veredicto: ✅ APROVADO**

## Resumo Executivo
- Agentes revisados: 6
- Itens bloqueantes: 0
- Itens não-bloqueantes: 3
- **Veredicto: ✅ APROVADO PARA PRODUÇÃO**

## Versões Verificadas
| Dependência | Versão | Status |
|---|---|---|
| Node.js | 22.3.0 LTS | ✅ |
| React | 18.2.0 | ✅ |
| Express | 4.18.2 | ✅ |
| Chart.js | 4.4.2 | ✅ |
| N8N target | 1.x LTS | ✅ |

## 🟡 Itens Não-Bloqueantes
1. **Adicionar express-rate-limit ao backend** — Recomendado se a API for exposta publicamente
2. **Implementar TypeScript no frontend** — Melhora manutenibilidade a longo prazo
3. **Adicionar testes unitários** — Formatters e dataService sem cobertura de teste

## Próximos Passos para Produção
1. Importar workflow no N8N (https://workflows.tmrodrigues.tech/)
2. Configurar variáveis de ambiente no N8N (DAPIC_API_URL, DAPIC_USER, DAPIC_PASSWORD)
3. Testar execução manual do workflow antes de ativar o agendamento
4. Fazer deploy do dashboard (backend porta 3001 + frontend build servido pelo Express)
5. Verificar que os dados aparecem corretamente no dashboard
```
