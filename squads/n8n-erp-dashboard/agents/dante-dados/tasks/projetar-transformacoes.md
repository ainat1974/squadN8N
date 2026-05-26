---
task: "Projetar Transformações de Dados"
order: 2
input: |
  - data_analysis: Análise de dados brutos da task anterior
output: |
  - transformation_spec: Especificação completa de todas as transformações necessárias
---

# Projetar Transformações de Dados

Define as transformações exatas que devem ser aplicadas sobre os dados brutos da API Dapic para produzir dados limpos e estruturados para o dashboard.

## Process

1. **Definir transformações de tipo**: Para cada campo com tipo incorreto, especificar a função de conversão exata
2. **Definir normalização de formato**: Datas, monetários, strings — regras de normalização específicas
3. **Definir cálculos derivados**: KPIs calculados (ticket médio, saldo CP vs CR, variação % diária)
4. **Definir agregações**: Como os dados são agregados por período (dia, semana, mês) para os gráficos
5. **Especificar código de transformação**: Funções JavaScript prontas para usar no N8N Function node

## Output Format

```markdown
# Especificação de Transformações — ERP Dapic

## Funções de Conversão

### monetaryToNumber(value)
Converte string monetária pt-BR para number:
```javascript
function monetaryToNumber(value) {
  if (typeof value === 'number') return value;
  return parseFloat(value.replace(/\./g, '').replace(',', '.'));
}
```

## Transformações por Relatório

### Vendas
| Campo | Transformação | Função |
|---|---|---|
| valor_total | string → number | monetaryToNumber |
| data_venda | "DD/MM/YYYY" → "YYYY-MM-DD" | dateToISO |

## KPIs Calculados
- ticket_medio = valor_total / count
- receita_diaria = sum(valor_total) GROUP BY data_venda

## Schema de Saída
```json
{
  "vendas": {
    "data": "YYYY-MM-DD",
    "total_registros": 0,
    "receita_total": 0.00,
    "ticket_medio": 0.00
  }
}
```

## Quality Criteria

- [ ] Função de conversão monetária definida e testada com exemplos
- [ ] Normalização de datas especificada com formato de entrada e saída
- [ ] KPIs calculados documentados com fórmula
- [ ] Código JavaScript pronto para N8N Function node
- [ ] Schema de saída definido para cada relatório

## Veto Conditions

Rejeitar e refazer se:
1. Código JavaScript de transformação não está funcional (erro de sintaxe ou lógica incorreta)
2. KPIs críticos (receita, saldo, variação) não foram especificados
