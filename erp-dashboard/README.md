# Tech Malhas — Dashboard ERP

Dashboard executivo integrado ao ERP Dapic via N8N workflows.

## Stack

- **Frontend:** React 18 + Vite 5 + Tailwind CSS 3
- **Gráficos:** Chart.js 4 + react-chartjs-2
- **Autenticação:** Google OAuth 2.0
- **Dados:** N8N workflows → JSON estático → Express API
- **Deploy:** Vercel

## Setup local

```bash
cd erp-dashboard
npm install
cp .env.example .env.local
# preencha o .env.local com suas credenciais
npm run dev
```

## Variáveis de ambiente

Veja `.env.example` para a lista completa. Configure as mesmas na Vercel antes do deploy.

## Estrutura

```
erp-dashboard/
├── src/
│   ├── components/     # Layout, Sidebar, Header, PrivateRoute
│   ├── pages/          # OverviewPage, SalesPage, StockPage, FinancialPage, LoginPage
│   └── main.tsx
├── index.html
├── vercel.json
└── package.json
```
