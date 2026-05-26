---
task: "Analisar Estrutura dos Dados Brutos"
order: 1
input: |
  - api_documentation: Schemas JSON de resposta da API Dapic
output: |
  - data_analysis: Análise de qualidade e estrutura dos dados por relatório
---

# Analisar Estrutura dos Dados Brutos da API Dapic

Analisa os schemas retornados pela API Dapic identificando tipos de dados, campos críticos, possíveis inconsistências e requisitos de transformação para cada relatório.

## Process

1. **Inventariar campos por relatório**: Para Vendas, Estoque, CP e CR — listar todos os campos com seus tipos atuais na API
2. **Identificar campos críticos para o dashboard**: Quais campos serão exibidos nos gráficos e KPIs — esses têm prioridade máxima de qualidade
3. **Detectar problemas potenciais**: Campos monetários como string, datas em formato não-padrão, IDs potencialmente duplicados, campos nullable que não deveriam ser
4. **Mapear relacionamentos**: Identificar campos que relacionam relatórios entre si (ex: produto_id aparece em Vendas e Estoque)
5. **Estimar volume de dados**: Com base nos schemas e paginação, estimar volume diário de registros por relatório

## Output Format

```markdown
# Análise de Dados Brutos — ERP Dapic

## Relatório: Vendas
| Campo API | Tipo API | Tipo Esperado | Problema | Transformação |
|---|---|---|---|---|
| data_venda | string | string (ISO) | Formato "DD/MM/YYYY" | Converter para YYYY-MM-DD |
| valor_total | string | number | Vírgula decimal | Substituir "," por "." e converter |

### Campos Críticos para Dashboard
- KPI Receita Total: `valor_total` (sum)
- Série temporal: `data_venda` (group by)

### Estimativa de Volume
~100-500 registros/dia (baseado em paginação documentada)

## Relatório: Estoque
...
```

## Output Example

```markdown
# Análise de Dados Brutos — ERP Dapic v2.1

## Relatório: Vendas

### Inventário de Campos
| Campo API | Tipo Retornado | Tipo Ideal | Problema Detectado | Ação Necessária |
|---|---|---|---|---|
| `id` | string | string | ✅ OK | Nenhuma |
| `data_venda` | string | string | ⚠️ Formato "15/01/2024" | Converter para "2024-01-15" |
| `valor_total` | string | number | ⚠️ "1.425,00" (pt-BR) | Normalizar para 1425.00 |
| `cliente.nome` | string | string | ✅ OK | Nenhuma |
| `status` | string | string | ⚠️ Valores inconsistentes: "FATURADO", "faturado", "Faturado" | Normalizar para lowercase |
| `itens` | array | array | ✅ OK | Desnormalizar produto mais vendido |

### Campos Críticos para Dashboard
- **Receita Total**: `valor_total` → soma diária/mensal
- **Volume de Vendas**: `id` → contagem
- **Ticket Médio**: `valor_total` / count → calculado
- **Série Temporal**: `data_venda` → agrupamento por dia

### Estimativa de Volume
- ~200 registros/dia → 2 páginas de 100 (paginação detectada)
- Tempo estimado de coleta: ~5 segundos

## Relatório: Estoque

### Inventário de Campos
| Campo API | Tipo Retornado | Tipo Ideal | Problema | Ação |
|---|---|---|---|---|
| `produto_id` | string | string | ✅ OK | Nenhuma |
| `estoque_atual` | number | number | ✅ OK | Nenhuma |
| `valor_total_estoque` | string | number | ⚠️ Formato pt-BR | Normalizar |
| `ultima_movimentacao` | string | string | ✅ ISO 8601 | Nenhuma |

## Relacionamentos Entre Relatórios
| Campo | Vendas | Estoque | CP | CR |
|---|---|---|---|---|
| `produto_id` | itens[].produto_id | produto_id | — | — |
| `cliente.id` | cliente.id | — | — | cliente_id |

## Resumo de Problemas Encontrados
- 🔴 Crítico: 2 campos monetários como string (Vendas, Estoque)
- 🟡 Médio: Datas em formato pt-BR (Vendas)
- 🟡 Médio: Status com case inconsistente (Vendas)
- 🟢 Baixo: Nenhum campo obrigatório nulo identificado
```

## Quality Criteria

- [ ] Todos os 4 relatórios analisados
- [ ] Campos críticos para dashboard identificados em cada relatório
- [ ] Problemas de tipo de dados identificados e quantificados
- [ ] Relacionamentos entre relatórios mapeados
- [ ] Estimativa de volume de dados por relatório

## Veto Conditions

Rejeitar e refazer se:
1. Algum dos 4 relatórios não foi analisado
2. Campos monetários ou de data não foram identificados para transformação
