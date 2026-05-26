# Relatorio de Otimizacao - Otto

## Metricas Antes/Depois

| Metrica | Workflow Original | Workflow Otimizado | Ganho |
|---|---:|---:|---:|
| Tempo estimado sequencial | ~28s | n/a | baseline |
| Tempo estimado com fan-out | ~15s | ~14s | ~50% vs sequencial |
| Nodes | 20 | 22 | + API GET /erp |
| Auth Dapic | 1 chamada | 1 chamada, com retry 3x | resiliencia |
| Branches de coleta | 4 branches paralelos | 4 branches paralelos | mantido |
| Registros por pagina | 200 | 200 | maximo permitido |
| Retry 429/5xx nas coletas | ausente nos Code nodes | 1s, 2s, 4s | falhas transientes cobertas |
| Token expirado durante execucao | falha no branch | renova 1x em HTTP 401 | recuperacao automatica |

## Otimizacoes Aplicadas

1. Fan-out paralelo preservado: o node Preparar Contexto dispara Vendas, Estoque, Contas a Pagar e Contas a Receber simultaneamente. A latencia total fica limitada pelo branch mais lento, estimado em ~9s de coleta.
2. Token centralizado: a autenticacao continua acontecendo uma unica vez antes do fan-out. Os branches reutilizam o token do contexto e renovam apenas se a API retornar HTTP 401.
3. Backoff exponencial: os Code nodes de coleta agora repetem chamadas em HTTP 429 e 5xx com esperas de 1s, 2s e 4s antes de falhar.
4. Paginacao eficiente: todos os loops paginados enviam RegistrosPorPagina=200, reduzindo calls e throughput desperdicado.
5. Rate limit preservado: cada branch pagina sequencialmente com 650ms entre paginas, mantendo menos de 100 req/min por endpoint.
6. Node morto removido: Merge Triggers nao estava conectado ao grafo real de execucao. Foi removido do JSON otimizado para reduzir ruido sem alterar comportamento.
7. Coleta diaria D-1: a execucao das 06:00 calcula `dataColeta` no fuso `America/Sao_Paulo` e consulta somente o dia anterior na Dapic.
8. Load migrado para N8N Static Data: a execucao diaria salva o snapshot D-1 em `staticData.erp` e alimenta `staticData.erp.historico.diario` para suportar 7d/30d/90d sem janelas longas na API.
9. API do dashboard adicionada: `GET /webhook/erp?modulo=...` retorna resumo, vendas agregadas por historico diario, estoque, contas a pagar, contas a receber e fluxo de caixa com headers CORS.
10. Idempotencia preservada: rerodar o mesmo D-1 substitui o registro diario daquela data em Static Data, sem duplicar valores.

## Constraints Verificados

- [x] JSON otimizado valido e parseavel.
- [x] Branches paralelos implementados para os 4 relatorios.
- [x] RegistrosPorPagina=200 em todos os endpoints paginados.
- [x] Retry com backoff exponencial em erros 429/5xx.
- [x] Token obtido uma unica vez e reutilizado em toda a execucao.
- [x] Renovacao automatica em 401 sem reiniciar o workflow inteiro.
- [x] Rate limit estimado: maximo ~92 req/min por endpoint em paginacao continua (650ms entre paginas), abaixo do limite de 100 req/min.
- [x] Error handling preservado: Error Trigger + Notificar Erro mantidos.
- [x] API GET /erp registrada e com Access-Control-Allow-Origin.
- [x] Workflow idempotente: saida D-1 substitui o registro da mesma data em Static Data.

## Output

- Workflow otimizado: `squads/n8n-erp-dashboard/output/workflow-n8n-otimizado.json`
