---
task: "Mapear Endpoints da API Dapic"
order: 1
input: |
  - foco_coleta: Quais relatórios coletar (Vendas, Estoque, CP, CR) e período
  - dapic_api_docs: URL ou conteúdo da documentação oficial da API Dapic
output: |
  - endpoints_map: Lista completa de endpoints com URL, método, parâmetros e descrição
  - auth_method: Método de autenticação identificado
---

# Mapear Endpoints da API Dapic

Pesquisa e mapeia todos os endpoints da API do ERP Dapic relevantes para os relatórios de Vendas, Estoque, Contas a Pagar e Contas a Receber, usando a documentação oficial.

## Process

1. **Acessar documentação oficial**: Usar web_fetch na URL da documentação Dapic para obter a lista completa de endpoints disponíveis
2. **Filtrar endpoints relevantes**: Identificar apenas os endpoints relacionados a Vendas, Estoque, Contas a Pagar e Contas a Receber
3. **Documentar cada endpoint**: Para cada um, registrar: URL base, versão da API, método HTTP, parâmetros obrigatórios e opcionais, descrição do recurso
4. **Identificar método de autenticação**: Verificar se usa API Key, OAuth 2.0, JWT Bearer ou Basic Auth, documentando o fluxo completo
5. **Verificar paginação**: Identificar se os endpoints paginar resultados e como funciona (limit/offset, cursor, page/per_page)

## Output Format

```markdown
# Mapa de Endpoints — API Dapic

## Autenticação
- **Método**: [Bearer Token / API Key / OAuth2]
- **Header**: `Authorization: Bearer {{DAPIC_API_TOKEN}}`
- **Obtenção do token**: [URL e payload para gerar token]
- **Validade do token**: [duração em segundos/horas]

## Endpoints de Vendas
| Campo | Valor |
|---|---|
| URL | `GET /api/v1/vendas` |
| Parâmetros | `data_inicio`, `data_fim`, `page`, `limit` |
| Descrição | Retorna relatório de vendas no período |

## Endpoints de Estoque
...

## Endpoints de Contas a Pagar
...

## Endpoints de Contas a Receber
...

## Rate Limits
- Máximo de X requisições por minuto
- Estratégia recomendada: aguardar Y ms entre chamadas
```

## Output Example

```markdown
# Mapa de Endpoints — API Dapic v2.1

## Autenticação
- **Método**: Bearer Token (JWT)
- **Header**: `Authorization: Bearer {{DAPIC_API_TOKEN}}`
- **Endpoint de login**: `POST /api/auth/token`
- **Payload**: `{"username": "{{DAPIC_USER}}", "password": "{{DAPIC_PASS}}"}`
- **Validade do token**: 3600 segundos (1 hora) — renovação necessária

## Endpoints de Vendas
| Campo | Valor |
|---|---|
| URL | `GET /api/v2/relatorios/vendas` |
| Parâmetros | `data_inicio` (YYYY-MM-DD), `data_fim` (YYYY-MM-DD), `page` (int), `limit` (int, max 100) |
| Descrição | Retorna lista de vendas realizadas no período informado |
| Paginação | Sim — campo `meta.total_pages` indica total de páginas |

## Endpoints de Estoque
| Campo | Valor |
|---|---|
| URL | `GET /api/v2/relatorios/estoque` |
| Parâmetros | `data_referencia` (YYYY-MM-DD), `categoria` (opcional) |
| Descrição | Retorna posição de estoque na data de referência |
| Paginação | Não — retorna todos os itens em uma única resposta |

## Rate Limits
- Máximo de 60 requisições por minuto por token
- Recomendação: 1 requisição por segundo (delay de 1000ms entre chamadas)
```

## Quality Criteria

- [ ] Todos os 4 grupos de endpoints identificados e documentados
- [ ] Método de autenticação completamente documentado com exemplo de header
- [ ] Parâmetros de data/período documentados (formato YYYY-MM-DD ou outro)
- [ ] Paginação identificada e documentada para cada endpoint
- [ ] Rate limits documentados

## Veto Conditions

Rejeitar e refazer se:
1. Algum dos 4 grupos de endpoints (Vendas, Estoque, CP, CR) não foi encontrado na documentação
2. O método de autenticação não foi identificado claramente
