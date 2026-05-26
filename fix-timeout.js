/**
 * fix-timeout.js
 * Corrige o timeout de 60s no Coletar Vendas e Coletar Estoque
 * - Reduz intervalo entre páginas: 650ms → 300ms
 * - Adiciona timeout de 15s por requisição
 * - Adiciona limite máximo de 10 páginas por endpoint (proteção)
 * - Usa 7 dias em vez de 30 dias para Vendas (mais rápido)
 * - Remove endpoint B2B (pedidosvendas) — simplifica para PDV apenas
 */
const https = require('https');
const API_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiI5ZWQyZDYyNy05NDQwLTRiZWMtYjcwMS1hZDZmZThlM2M3ODgiLCJpc3MiOiJuOG4iLCJhdWQiOiJwdWJsaWMtYXBpIiwianRpIjoiY2U3NGNjNGItMWE3MC00MmMyLWE1ZWYtNjZmYTI4MDcxYTZjIiwiaWF0IjoxNzc5NzUwMzE5fQ.qt_jMJ4J8hrev6xeCUd2SLk8LvmdF1X510KDh8_iav4';
const WORKFLOW_ID = '5vEtPrd4vzjCBK9w';
const HOST = 'workflows.tmrodrigues.tech';

function api(method, path, body) {
  return new Promise((resolve, reject) => {
    const bodyStr = body ? JSON.stringify(body) : undefined;
    const req = https.request({
      hostname: HOST, path: `/api/v1${path}`, method,
      headers: {
        'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json',
        ...(bodyStr ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(bodyStr) } : {})
      }
    }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(d) }); } catch { resolve({ status: res.statusCode, body: d }); } });
    });
    req.on('error', reject);
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ─── Coletar Vendas — versão otimizada para não dar timeout ──────────────────
const COLETAR_VENDAS_CODE = `// ============================================================
// COLETAR VENDAS — PDV (últimos 7 dias para performance)
// Limites: 300ms entre páginas, timeout 15s/req, máx 8 páginas
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, baseUrl } = ctx;

// Calcular últimos 7 dias inline (mais rápido que 30 dias)
const hoje = new Date();
const data7DiasAtras = new Date(hoje);
data7DiasAtras.setDate(hoje.getDate() - 7);
const dataHoje = hoje.toISOString().split('T')[0];
const dataInicio = data7DiasAtras.toISOString().split('T')[0];

async function fetchAllPages(endpoint, params = {}) {
  let allData = [];
  let pagina = 1;
  let totalPaginas = 1;
  const MAX_PAGINAS = 8; // proteção anti-loop infinito

  do {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}\${endpoint}\`,
      headers: { 'Authorization': \`Bearer \${token}\` },
      qs: { ...params, Pagina: pagina, RegistrosPorPagina: 200 },
      json: true,
      timeout: 15000
    });

    if (response.Dados && response.Dados.length > 0) {
      allData = allData.concat(response.Dados);
    }

    totalPaginas = Math.min(response.TotalPaginas || 1, MAX_PAGINAS);
    if (pagina < totalPaginas) await new Promise(r => setTimeout(r, 300));
    pagina++;
  } while (pagina <= totalPaginas);

  return allData;
}

// Vendas PDV com produtos (endpoint confirmado)
const vendasPDV = await fetchAllPages.call(this, '/v1/vendaspdv/produtos', {
  DataInicial: dataInicio,
  DataFinal: dataHoje,
  FiltrarPor: 0,
  Status: 1
});

const produtosVendidos = vendasPDV;

return [{ json: {
  pedidosVenda: [],
  vendasPDV,
  produtosVendidos,
  periodoConsultado: \`\${dataInicio} → \${dataHoje}\`,
  totalRegistros: vendasPDV.length,
  coletadoEm: new Date().toISOString()
} }];`;

// ─── Coletar Estoque — versão otimizada ──────────────────────────────────────
const COLETAR_ESTOQUE_CODE = `// ============================================================
// COLETAR ESTOQUE — Saldo Atual + Movimentações 7 dias
// Limites: 300ms entre páginas, timeout 15s/req, máx 8 páginas
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, baseUrl } = ctx;

// Calcular datas inline
const hoje = new Date();
const data7DiasAtras = new Date(hoje);
data7DiasAtras.setDate(hoje.getDate() - 7);
const dataHoje = hoje.toISOString().split('T')[0];
const dataInicio = data7DiasAtras.toISOString().split('T')[0];

async function fetchAllPages(endpoint, params = {}) {
  let allData = [];
  let pagina = 1;
  let totalPaginas = 1;
  const MAX_PAGINAS = 8;

  do {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}\${endpoint}\`,
      headers: { 'Authorization': \`Bearer \${token}\` },
      qs: { ...params, Pagina: pagina, RegistrosPorPagina: 200 },
      json: true,
      timeout: 15000
    });

    if (response.Dados && response.Dados.length > 0) {
      allData = allData.concat(response.Dados);
    }

    totalPaginas = Math.min(response.TotalPaginas || 1, MAX_PAGINAS);
    if (pagina < totalPaginas) await new Promise(r => setTimeout(r, 300));
    pagina++;
  } while (pagina <= totalPaginas);

  return allData;
}

// 1. Estoque atual (endpoint confirmado)
const estoqueAtual = await fetchAllPages.call(this, '/v1/armazenadores/produtos', {
  SaldoZerado: true
});

// 2. Movimentações dos últimos 7 dias
await new Promise(r => setTimeout(r, 1000));
let movimentacoes30d = [];
try {
  movimentacoes30d = await fetchAllPages.call(this, '/v1/movimentacoesestoque', {
    DataInicial: dataInicio,
    DataFinal: dataHoje
  });
} catch(e) {
  console.log('Aviso movimentações:', e.message);
}

return [{ json: {
  estoqueAtual,
  movimentacoes30d,
  movimentacoesSemanaAnterior: [],
  periodoConsultado: \`\${dataInicio} → \${dataHoje}\`,
  totalEstoque: estoqueAtual.length,
  coletadoEm: new Date().toISOString()
} }];`;

async function main() {
  const { body: wf } = await api('GET', `/workflows/${WORKFLOW_ID}`);
  console.log('✅ Workflow obtido:', wf.name, '|', wf.nodes.length, 'nodes\n');

  const changes = [];

  const coletarVendas = wf.nodes.find(n => n.name === '📊 Coletar Vendas');
  if (coletarVendas) {
    coletarVendas.parameters.jsCode = COLETAR_VENDAS_CODE;
    changes.push('✅ Coletar Vendas: 7 dias, 300ms, timeout 15s, máx 8 págs');
  } else {
    console.log('⚠️  Node "📊 Coletar Vendas" não encontrado!');
  }

  const coletarEstoque = wf.nodes.find(n => n.name === '📦 Coletar Estoque');
  if (coletarEstoque) {
    coletarEstoque.parameters.jsCode = COLETAR_ESTOQUE_CODE;
    changes.push('✅ Coletar Estoque: 7 dias, 300ms, timeout 15s, máx 8 págs');
  } else {
    console.log('⚠️  Node "📦 Coletar Estoque" não encontrado!');
  }

  changes.forEach(c => console.log(c));

  await api('POST', `/workflows/${WORKFLOW_ID}/deactivate`);
  await sleep(800);

  const allowedSettings = {};
  for (const k of ['saveManualExecutions','callerPolicy','timezone','executionOrder']) {
    if (wf.settings?.[k] !== undefined) allowedSettings[k] = wf.settings[k];
  }

  const { status } = await api('PUT', `/workflows/${WORKFLOW_ID}`, {
    name: wf.name,
    nodes: wf.nodes.map(({ notes, ...r }) => r),
    connections: wf.connections,
    settings: allowedSettings,
    staticData: wf.staticData || null
  });
  console.log('\n📤 Salvo:', status === 200 ? '✅' : '❌ status ' + status);

  await sleep(500);
  await api('POST', `/workflows/${WORKFLOW_ID}/activate`);
  console.log('▶️  Reativado. Teste agora com "from ⏰ Cron Diário 06:00"!');
}
main().catch(console.error);
