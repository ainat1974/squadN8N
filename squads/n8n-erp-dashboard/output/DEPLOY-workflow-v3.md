# Deploy — Workflow N8N v3 (coleta por intervalo)

## O que muda

| Antes (v2) | Depois (v3) |
|------------|---------------|
| Cron 06h coleta D-1 | **Sem cron** |
| `POST /atualizar` ignora datas | Lê `{ dataInicial, dataFinal }` |
| `staticData.erp.historico.diario` | `staticData.erp.ultimaConsulta` |
| `GET /erp?dias=N` agrega histórico | Retorna **última consulta** completa |
| Só vendas na coleta otimizada | Vendas (range) + **Estoque snapshot** |

## Arquivo

`squads/n8n-erp-dashboard/output/workflow-n8n-v3-range.json`

Gerar novamente:

```bash
node scripts/build-workflow-v3-range.js
```

## Passo a passo no N8N

1. Abra https://workflows.tmrodrigues.tech/
2. Localize o workflow ativo do ERP (Tech Malhas)
3. **Exporte backup** do workflow atual (⋯ → Download)
4. **Importe** `workflow-n8n-v3-range.json` (Import from File)
5. Confirme variáveis em **Settings → Variables**:
   - `DAPIC_EMPRESA` = `techmalhasfranca`
   - `DAPIC_TOKEN_INTEGRACAO` = (seu token)
6. **Desative** o workflow antigo (evita 2 webhooks `/atualizar` e `/erp`)
7. **Ative** o workflow v3
8. Teste manual:
   ```bash
   curl -X POST "https://workflows.tmrodrigues.tech/webhook/atualizar" \
     -H "Content-Type: application/json" \
     -d "{\"dataInicial\":\"2026-05-28\",\"dataFinal\":\"2026-05-28\"}"
   ```
9. Após ~1–2 min:
   ```bash
   curl "https://workflows.tmrodrigues.tech/webhook/erp?modulo=resumo&dataInicial=2026-05-28&dataFinal=2026-05-28"
   ```
   Deve retornar `dataInicial`, `dataFinal`, `receita_total`, etc.

## Frontend (já pronto)

O dashboard em `erp-dashboard/` já envia:

- `POST /webhook/atualizar` com body `{ dataInicial, dataFinal }`
- `GET /webhook/erp?modulo=...&dataInicial=...&dataFinal=...&dias=N`

Após deploy do v3, intervalos customizados (ex. 01/04–30/04) passam a funcionar de ponta a ponta.

## Rollback

Re-importe o backup exportado no passo 3 e reative o workflow antigo.

## Limitações v3

- Financeiro (CP/CR/fluxo) **não é coletado** nesta versão — módulos retornam dados legados em `staticData` se existirem, ou vazio.
- Intervalo máximo: **90 dias** (validado no N8N e no frontend).
- Coleta de estoque é sempre **snapshot atual**, independente do intervalo de vendas.
