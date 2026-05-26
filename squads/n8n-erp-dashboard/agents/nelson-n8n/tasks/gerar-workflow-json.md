---
task: "Gerar JSON do Workflow N8N"
order: 2
input: |
  - workflow_architecture: Arquitetura projetada na task anterior
  - api_documentation: Documentação da API Dapic
output: |
  - workflow_json: JSON completo e válido para importação no N8N
---

# Gerar JSON do Workflow N8N

Gera o JSON completo do workflow N8N baseado na arquitetura projetada, pronto para importação via N8N UI (Settings → Import Workflow).

## Process

1. **Estruturar o JSON base**: Criar o objeto raiz com `name`, `nodes`, `connections` e `settings` conforme schema do N8N
2. **Gerar cada node**: Para cada node definido na arquitetura, gerar o objeto JSON completo com `id`, `name`, `type`, `typeVersion`, `position` e `parameters`
3. **Mapear connections**: Definir as conexões entre nodes no objeto `connections` — `sourceNode → targetNode` via `main[0]`
4. **Configurar credenciais por referência**: Nodes que usam credenciais referenciam pelo nome da credencial N8N (sem valores reais)
5. **Validar JSON**: Verificar que o JSON é válido (sem erros de sintaxe) e que todos os nodes referenciados nas connections existem

## Output Format

```json
{
  "name": "ERP Dapic — Coleta Diária",
  "nodes": [
    {
      "id": "uuid-1",
      "name": "Cron Diário",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [240, 300],
      "parameters": {
        "rule": {
          "interval": [{ "field": "cronExpression", "expression": "0 6 * * *" }]
        }
      }
    }
  ],
  "connections": {
    "Cron Diário": {
      "main": [[{ "node": "Obter Token", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1"
  }
}
```

## Output Example

```json
{
  "name": "ERP Dapic — Coleta Diária",
  "nodes": [
    {
      "id": "a1b2c3d4-0001",
      "name": "Cron Diário 06h",
      "type": "n8n-nodes-base.scheduleTrigger",
      "typeVersion": 1.1,
      "position": [200, 300],
      "parameters": {
        "rule": {
          "interval": [
            { "field": "cronExpression", "expression": "0 6 * * *" }
          ]
        }
      }
    },
    {
      "id": "a1b2c3d4-0002",
      "name": "Obter Token Dapic",
      "type": "n8n-nodes-base.httpRequest",
      "typeVersion": 4.2,
      "position": [440, 300],
      "parameters": {
        "method": "POST",
        "url": "={{ $vars.DAPIC_API_URL }}/api/auth/token",
        "sendBody": true,
        "contentType": "json",
        "body": {
          "username": "={{ $vars.DAPIC_USER }}",
          "password": "={{ $vars.DAPIC_PASSWORD }}"
        },
        "options": { "response": { "response": { "responseFormat": "json" } } }
      },
      "onError": "continueErrorOutput"
    },
    {
      "id": "a1b2c3d4-0003",
      "name": "Extrair Token",
      "type": "n8n-nodes-base.set",
      "typeVersion": 3.4,
      "position": [660, 300],
      "parameters": {
        "mode": "manual",
        "assignments": {
          "assignments": [
            {
              "name": "access_token",
              "value": "={{ $json.access_token }}",
              "type": "string"
            }
          ]
        }
      }
    }
  ],
  "connections": {
    "Cron Diário 06h": {
      "main": [[{ "node": "Obter Token Dapic", "type": "main", "index": 0 }]]
    },
    "Obter Token Dapic": {
      "main": [[{ "node": "Extrair Token", "type": "main", "index": 0 }]],
      "error": [[{ "node": "Alerta Falha Auth", "type": "main", "index": 0 }]]
    },
    "Extrair Token": {
      "main": [[{ "node": "HTTP Vendas Página 1", "type": "main", "index": 0 }]]
    }
  },
  "settings": {
    "executionOrder": "v1",
    "saveManualExecutions": true,
    "callerPolicy": "workflowsFromSameOwner",
    "errorWorkflow": ""
  },
  "tags": ["erp", "dapic", "coleta-dados", "producao"]
}
```

## Quality Criteria

- [ ] JSON válido (sem erros de sintaxe)
- [ ] Todos os nodes da arquitetura presentes no JSON
- [ ] `typeVersion` compatível com N8N v1.x LTS estável
- [ ] Connections mapeiam todos os fluxos (principal + erro)
- [ ] Sem credenciais reais no JSON — apenas referências `$vars.` ou credential names
- [ ] Tags de identificação incluídas

## Veto Conditions

Rejeitar e refazer se:
1. JSON inválido (erro de sintaxe — chaves não fechadas, vírgulas incorretas)
2. Algum node referenciado em `connections` não existe em `nodes`
