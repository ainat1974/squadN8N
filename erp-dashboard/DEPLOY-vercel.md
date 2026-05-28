# Deploy Vercel — erp-dashboard

## URL de produção

https://tech-malhas-dashboard.vercel.app

## Como publicar (com filtro de intervalo e demais mudanças locais)

O projeto na Vercel usa **Root Directory** = `erp-dashboard`. Por isso o deploy deve ser feito **na raiz do repositório**, não dentro de `erp-dashboard/`:

```powershell
cd c:\PROJECT\squadN8N
npx vercel@latest deploy --prod --yes
```

Erro comum se rodar dentro de `erp-dashboard/`:  
`The provided path ...\erp-dashboard\erp-dashboard does not exist`

## Variáveis de ambiente (Vercel → Project Settings → Environment Variables)

| Variável | Uso |
|----------|-----|
| `VITE_SUPABASE_URL` | Login |
| `VITE_SUPABASE_ANON_KEY` | Login |
| `VITE_N8N_WEBHOOK_URL` | `https://workflows.tmrodrigues.tech/webhook/atualizar` |
| `VITE_API_URL` | Opcional (API usa N8N direto em `services/api.ts`) |

Após alterar env vars, faça **Redeploy** em Production.

## Deploy automático via GitHub

Push na branch `main` do repo `ainat1974/squadN8N` também dispara build (se o projeto estiver ligado ao Git).

## Último deploy manual (filtro de intervalo)

- **ID:** `dpl_8S78PsyC1PQrmJnowAaLwojoQssr`
- **Data:** 2026-05-28
- **Bundle:** `index-BlhUB3-0.js` (inclui `DateRangePicker`, `useTriggerColeta`, range no `PeriodContext`)
