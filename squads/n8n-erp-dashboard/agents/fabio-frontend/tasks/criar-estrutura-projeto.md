---
task: "Criar Estrutura do Projeto"
order: 1
input: |
  - design_spec: Especificação de componentes e design system
  - data_schema: Schema de dados e endpoints da API backend
output: |
  - project_structure: Estrutura de arquivos completa do projeto e package.json configurado
---

# Criar Estrutura do Projeto Full Stack

Define e documenta a estrutura completa do projeto — monorepo com backend Node.js/Express e frontend React/Vite — com todas as dependências nas versões estáveis corretas.

## Process

1. **Definir arquitetura do projeto**: Monorepo com `/backend` e `/frontend`, ou projeto unificado com servidor Express servindo o build React
2. **Especificar dependências**: Backend (Express, cors, dotenv, helmet) e Frontend (React 18, Chart.js 4, React Router 6, Tailwind CSS 3) — sempre versões LTS/stable
3. **Gerar package.json de ambos**: Scripts de desenvolvimento, build e produção
4. **Definir variáveis de ambiente**: `.env.example` com todas as variáveis necessárias documentadas
5. **Definir estrutura de arquivos**: Árvore de diretórios completa antes de qualquer código

## Output Format

```markdown
# Estrutura do Projeto — ERP Dashboard

## Arquitetura
[Descrição da arquitetura escolhida e justificativa]

## Árvore de Arquivos
```
erp-dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   ├── services/
│   │   └── index.js
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── main.jsx
│   ├── package.json
│   └── index.html
└── README.md
```

## package.json — Backend
```json
{ "dependencies": { "express": "^4.18.2" } }
```

## package.json — Frontend
```json
{ "dependencies": { "react": "^18.2.0" } }
```

## .env.example
```
DATA_PATH=../data/erp
PORT=3001
```
```

## Output Example

```markdown
# Estrutura do Projeto — ERP Dashboard Dapic

## Arquitetura Escolhida
Monorepo com backend e frontend separados:
- **Backend**: Node.js 22 LTS + Express 4.x — serve a API REST de dados
- **Frontend**: React 18.x + Vite 5.x — SPA com Chart.js 4.x para gráficos
- **Comunicação**: Frontend faz fetch para `http://localhost:3001/api/*` (dev) ou `/api/*` (produção via proxy Nginx/Express static)

## Árvore de Arquivos Completa
```
erp-dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/
│   │   │   ├── vendas.js
│   │   │   ├── estoque.js
│   │   │   ├── contasPagar.js
│   │   │   ├── contasReceber.js
│   │   │   └── resumo.js
│   │   ├── services/
│   │   │   └── dataService.js    # Lê os arquivos JSON do data/erp/
│   │   ├── middleware/
│   │   │   └── errorHandler.js
│   │   └── index.js              # Entry point do Express
│   ├── package.json
│   ├── .env
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── KPICard/
│   │   │   │   ├── KPICard.jsx
│   │   │   │   └── KPICard.css
│   │   │   ├── Charts/
│   │   │   │   ├── LineChart.jsx
│   │   │   │   ├── BarChart.jsx
│   │   │   │   └── DonutChart.jsx
│   │   │   ├── DataTable/
│   │   │   │   └── DataTable.jsx
│   │   │   ├── Sidebar/
│   │   │   │   └── Sidebar.jsx
│   │   │   └── LoadingState/
│   │   │       └── Skeleton.jsx
│   │   ├── pages/
│   │   │   ├── Resumo.jsx
│   │   │   ├── Vendas.jsx
│   │   │   ├── Estoque.jsx
│   │   │   ├── ContasPagar.jsx
│   │   │   └── ContasReceber.jsx
│   │   ├── hooks/
│   │   │   └── useApiData.js     # Hook customizado para fetch com loading/error
│   │   ├── utils/
│   │   │   └── formatters.js     # Formatação monetária, datas, percentuais
│   │   ├── styles/
│   │   │   └── tokens.css        # CSS custom properties do design system
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── data/
│   └── erp/                      # Dados coletados pelo N8N (gitignored)
└── README.md
```

## package.json — Backend
```json
{
  "name": "erp-dashboard-backend",
  "version": "1.0.0",
  "description": "API backend para o ERP Dashboard Dapic",
  "main": "src/index.js",
  "engines": { "node": ">=22.0.0" },
  "scripts": {
    "start": "node src/index.js",
    "dev": "nodemon src/index.js",
    "lint": "eslint src/"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.4.5",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.1.0",
    "eslint": "^8.57.0"
  }
}
```

## package.json — Frontend
```json
{
  "name": "erp-dashboard-frontend",
  "version": "1.0.0",
  "description": "Dashboard interativo ERP Dapic",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "lint": "eslint src/"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0",
    "chart.js": "^4.4.2",
    "react-chartjs-2": "^5.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.2.1",
    "vite": "^5.2.0",
    "tailwindcss": "^3.4.3",
    "autoprefixer": "^10.4.19",
    "postcss": "^8.4.38",
    "eslint": "^8.57.0",
    "eslint-plugin-react-hooks": "^4.6.0"
  }
}
```

## .env.example — Backend
```bash
# Servidor
PORT=3001
NODE_ENV=development

# Dados
DATA_PATH=../data/erp
HISTORY_DAYS=90
```
```

## Quality Criteria

- [ ] Arquitetura backend/frontend definida com justificativa
- [ ] Árvore de arquivos completa documentada
- [ ] package.json de ambos com versões específicas (não `*`)
- [ ] Node.js engine especificado (`>=22.0.0` LTS)
- [ ] .env.example com todas as variáveis documentadas
- [ ] Scripts de dev, build e start definidos

## Veto Conditions

Rejeitar e refazer se:
1. Versões de dependências não especificadas (usar `*` ou `latest` é inaceitável em produção)
2. .env.example ausente ou incompleto
