# Framework de Domínio — N8N ERP Dashboard

## Domínio Principal: Automação + Análise de Dados

Este squad opera na interseção de dois domínios:

### 1. Automação de Workflows (N8N)
**Metodologia**: ETL (Extract, Transform, Load) agendado
- **Extract**: Coletar dados via API REST do ERP Dapic
- **Transform**: Normalizar, limpar e estruturar os dados
- **Load**: Armazenar em formato JSON consumível pelo dashboard

**Princípios Fundamentais de Automação N8N:**
- Workflows idempotentes — execução dupla não gera duplicatas
- Error handling em cada step — zero falhas silenciosas
- Rate limiting respeitado — delay entre requisições
- Credenciais como variáveis — nunca hardcoded
- Paginação completa — coletar todos os registros, não só a primeira página

### 2. Análise e Visualização de Dados
**Metodologia**: Dashboard Executivo com KPIs acionáveis
- KPIs principais em destaque (receita, saldo, estoque)
- Séries temporais para análise de tendências
- Tabelas detalhadas para drill-down
- Filtros de período para contexto

**Princípios de Data Visualization:**
- Clareza antes de estética
- Hierarquia visual alinhada à importância do dado
- Cores semânticas (verde=positivo, vermelho=alerta)
- Performance: dados carregados sob demanda

## Stack Técnica Padrão do Squad

### Coleta de Dados
- **N8N**: v1.x LTS (https://workflows.tmrodrigues.tech/)
- **Protocolo**: REST API com autenticação JWT/Bearer
- **Formato**: JSON

### Processamento
- **Linguagem**: JavaScript (N8N Function nodes)
- **Armazenamento**: Arquivos JSON por data em `/data/erp/YYYY-MM-DD/`

### Backend
- **Runtime**: Node.js 22.x LTS
- **Framework**: Express 4.x
- **Middleware de segurança**: Helmet 7.x, CORS 2.x

### Frontend
- **Framework**: React 18.x
- **Bundler**: Vite 5.x
- **Gráficos**: Chart.js 4.x + react-chartjs-2 5.x
- **Estilos**: Tailwind CSS 3.x
- **Roteamento**: React Router 6.x

## Processo ETL Diário

```
06:00 — Cron Trigger dispara
    ↓
[1] Obter token de autenticação API Dapic
    ↓
[2] Coletar Vendas (com paginação + delay)
[3] Coletar Estoque (com paginação + delay)
[4] Coletar Contas a Pagar (com paginação + delay)
[5] Coletar Contas a Receber (com paginação + delay)
    ↓
[6] Transformar e normalizar dados
    ↓
[7] Salvar em /data/erp/YYYY-MM-DD/
    ↓
[8] Notificar sucesso (webhook/log)
```

## Estrutura de Dados Final

```
/data/erp/
  YYYY-MM-DD/
    vendas.json         → summary + serie_temporal + top_produtos
    estoque.json        → summary + items + alertas
    contas-pagar.json   → summary + vencimentos_proximos + por_status
    contas-receber.json → summary + vencimentos_proximos + por_status
```

## KPIs por Módulo

### Vendas
- Receita Total (sum valor_total)
- Total de Vendas (count)
- Ticket Médio (receita / count)
- Variação vs. Período Anterior (%)
- Top 5 Produtos por Receita

### Estoque
- Valor Total em Estoque
- Itens Abaixo do Mínimo (alertas)
- Giro de Estoque (movimentação/estoque_médio)

### Contas a Pagar
- Total Pendente
- Total Vencido (crítico)
- Próximos 7 Dias a Vencer

### Contas a Receber
- Total Pendente
- Total Vencido
- Próximos 7 Dias a Receber
- Saldo Líquido (CR - CP)
