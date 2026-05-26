---
task: "Implementar API Backend Node.js"
order: 2
input: |
  - project_structure: Estrutura de projeto definida
  - data_schema: Schema de dados e endpoints especificados pelo Dante Dados
output: |
  - backend_code: Código completo do backend Node.js/Express
---

# Implementar API Backend Node.js/Express

Implementa o servidor Node.js/Express que lê os arquivos JSON gerados pelo N8N e serve os dados formatados para o dashboard React.

## Process

1. **Implementar entry point (index.js)**: Configurar Express com middleware de segurança (helmet, cors) e registrar todas as rotas
2. **Implementar dataService.js**: Serviço que lê os arquivos JSON da pasta `/data/erp/` para uma data específica ou a mais recente
3. **Implementar cada rota**: `/api/dashboard/resumo`, `/api/dashboard/vendas`, `/api/dashboard/estoque`, `/api/dashboard/contas-pagar`, `/api/dashboard/contas-receber`
4. **Implementar error handler**: Middleware de tratamento de erros com respostas padronizadas
5. **Implementar formatters**: Funções de formatação monetária e de data consistentes

## Output Format

```javascript
// src/index.js — exemplo de estrutura
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL || 'http://localhost:5173' }));
app.use(express.json());

// Rotas
app.use('/api/dashboard', require('./routes/resumo'));
// ...

app.listen(process.env.PORT || 3001);
```

## Output Example

```javascript
// src/services/dataService.js
const fs = require('fs');
const path = require('path');

const DATA_PATH = process.env.DATA_PATH || '../data/erp';

/**
 * Retorna o caminho da pasta de dados para uma data específica ou a mais recente.
 * @param {string|null} date - Data no formato YYYY-MM-DD ou null para a mais recente
 * @returns {string} Caminho absoluto da pasta de dados
 */
function getDataPath(date = null) {
  const basePath = path.resolve(__dirname, '..', '..', DATA_PATH);
  
  if (date) {
    return path.join(basePath, date);
  }
  
  // Encontrar a pasta mais recente
  const dirs = fs.readdirSync(basePath)
    .filter(d => /^\d{4}-\d{2}-\d{2}$/.test(d))
    .sort()
    .reverse();
  
  if (dirs.length === 0) throw new Error('Nenhum dado encontrado');
  return path.join(basePath, dirs[0]);
}

/**
 * Lê e parseia um arquivo JSON de dados ERP.
 * @param {string} filename - Nome do arquivo (ex: 'vendas.json')
 * @param {string|null} date - Data ou null para a mais recente
 * @returns {Object} Dados parseados
 */
function readDataFile(filename, date = null) {
  const dataPath = getDataPath(date);
  const filePath = path.join(dataPath, filename);
  
  if (!fs.existsSync(filePath)) {
    throw new Error(`Arquivo não encontrado: ${filename} para a data ${date || 'mais recente'}`);
  }
  
  const content = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(content);
}

module.exports = { readDataFile, getDataPath };

// src/routes/vendas.js
const express = require('express');
const router = express.Router();
const { readDataFile } = require('../services/dataService');

/**
 * GET /api/dashboard/vendas
 * Retorna dados de vendas para o período especificado.
 * Query params:
 *   - date: YYYY-MM-DD (opcional, padrão: mais recente)
 *   - period: 7d | 30d | 90d (opcional, para série temporal)
 */
router.get('/vendas', async (req, res, next) => {
  try {
    const { date } = req.query;
    const data = readDataFile('vendas.json', date || null);
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
});

module.exports = router;

// src/middleware/errorHandler.js
/**
 * Middleware de tratamento de erros centralizado.
 * Retorna respostas de erro padronizadas.
 */
function errorHandler(err, req, res, next) {
  console.error(`[${new Date().toISOString()}] ERROR:`, err.message);
  
  if (err.message.includes('não encontrado')) {
    return res.status(404).json({
      success: false,
      error: 'Dados não encontrados para o período solicitado'
    });
  }
  
  res.status(500).json({
    success: false,
    error: 'Erro interno do servidor'
  });
}

module.exports = errorHandler;
```

## Quality Criteria

- [ ] Express configurado com helmet e cors
- [ ] Todos os 5 endpoints implementados (/resumo, /vendas, /estoque, /contas-pagar, /contas-receber)
- [ ] dataService.js implementado com leitura de arquivo por data
- [ ] Error handler centralizado implementado
- [ ] Respostas padronizadas `{ success: true/false, data/error }`
- [ ] Sem credenciais hardcoded — tudo via process.env

## Veto Conditions

Rejeitar e refazer se:
1. Algum dos 5 endpoints não está implementado
2. Não há tratamento de erro (sem try/catch nas rotas)
