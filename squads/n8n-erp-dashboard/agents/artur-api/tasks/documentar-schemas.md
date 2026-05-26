---
task: "Documentar Schemas de Resposta"
order: 3
input: |
  - endpoints_map: Mapa de endpoints documentado
  - auth_flow: Fluxo de autenticação validado
output: |
  - api_documentation: Documentação técnica completa pronta para o Nelson N8N usar
---

# Documentar Schemas de Resposta da API Dapic

Documenta os schemas JSON de resposta de cada endpoint, com exemplos realistas de dados, para que o Dante Dados possa projetar as transformações e o Nelson N8N possa mapear os campos no workflow.

## Process

1. **Documentar schema de Vendas**: Estrutura completa do JSON de resposta — campos, tipos, formatos de data, valores monetários
2. **Documentar schema de Estoque**: Campos de produto, quantidade, unidade, localização, valor
3. **Documentar schema de Contas a Pagar**: Campos de fornecedor, vencimento, valor, status, categoria
4. **Documentar schema de Contas a Receber**: Campos de cliente, vencimento, valor, status, parcela
5. **Compilar documentação final**: Consolidar tudo em um único arquivo `api-documentation.md` bem estruturado, pronto para o próximo agente

## Output Format

```markdown
# Documentação Técnica — API Dapic

## Schema: Vendas
```json
{
  "data": [
    {
      "id": "string",
      "data_venda": "YYYY-MM-DD",
      "cliente": "string",
      "valor_total": "number",
      "itens": [...]
    }
  ],
  "meta": {
    "total": "number",
    "page": "number",
    "per_page": "number"
  }
}
```

## Schema: Estoque
...

## Schema: Contas a Pagar
...

## Schema: Contas a Receber
...

## Resumo para o N8N
Campos críticos a mapear por relatório:
- Vendas: id, data_venda, valor_total, cliente
- Estoque: produto_id, quantidade, valor_unitario
- Contas a Pagar: fornecedor, vencimento, valor, status
- Contas a Receber: cliente, vencimento, valor, status
```

## Output Example

```markdown
# Documentação Técnica — API Dapic v2.1

## Schema: Relatório de Vendas (GET /api/v2/relatorios/vendas)

```json
{
  "data": [
    {
      "id": "VND-2024-001234",
      "data_venda": "2024-01-15",
      "numero_pedido": "PED-98765",
      "cliente": {
        "id": "CLI-456",
        "nome": "Empresa Exemplo Ltda",
        "cnpj": "00.000.000/0001-00"
      },
      "vendedor": "João Silva",
      "valor_produtos": 1500.00,
      "valor_desconto": 75.00,
      "valor_total": 1425.00,
      "status": "faturado",
      "itens": [
        {
          "produto_id": "PRD-001",
          "descricao": "Produto A",
          "quantidade": 10,
          "valor_unitario": 150.00,
          "valor_total": 1500.00
        }
      ]
    }
  ],
  "meta": {
    "total": 1250,
    "page": 1,
    "per_page": 100,
    "total_pages": 13
  }
}
```

## Schema: Estoque (GET /api/v2/relatorios/estoque)

```json
{
  "data": [
    {
      "produto_id": "PRD-001",
      "descricao": "Produto A",
      "unidade": "UN",
      "estoque_atual": 245,
      "estoque_minimo": 50,
      "estoque_maximo": 500,
      "valor_unitario": 150.00,
      "valor_total_estoque": 36750.00,
      "localizacao": "Galpão A - Prateleira 3",
      "ultima_movimentacao": "2024-01-14"
    }
  ]
}
```

## Resumo para o N8N — Campos Críticos
| Relatório | Campos Essenciais |
|---|---|
| Vendas | id, data_venda, valor_total, cliente.nome, status |
| Estoque | produto_id, descricao, estoque_atual, valor_total_estoque |
| Contas a Pagar | id, fornecedor, vencimento, valor, status |
| Contas a Receber | id, cliente, vencimento, valor, status |
```

## Quality Criteria

- [ ] Schema JSON completo documentado para todos os 4 relatórios
- [ ] Tipos de dados especificados (string, number, date format)
- [ ] Campos de paginação documentados (meta.total, meta.total_pages)
- [ ] Tabela de campos críticos compilada para o N8N
- [ ] Exemplos realistas com dados fictícios (não placeholders vazios)

## Veto Conditions

Rejeitar e refazer se:
1. Algum dos 4 schemas está ausente ou incompleto (sem tipos de dados)
2. Os exemplos JSON não são realistas (campos vazios ou sem valores de exemplo)
