/**
 * fix-endpoints.js
 * Corrige os endpoints nos nodes de coleta para usar os confirmados em api.dapic.com.br
 * Baseado nos workflows da própria usuária que já funcionam.
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
      headers: { 'X-N8N-API-KEY': API_KEY, 'Accept': 'application/json',
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

// ─── Novo código para Coletar Vendas ──────────────────────────────────────────
const COLETAR_VENDAS_CODE = `// ============================================================
// COLETAR VENDAS — PDV + Pedidos B2B
// Endpoints confirmados em api.dapic.com.br
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, dataHoje, data30DiasAtras, baseUrl } = ctx;

async function fetchAllPages(endpoint, params = {}) {
  let allData = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}\${endpoint}\`,
      headers: { 'Authorization': \`Bearer \${token}\` },
      qs: { ...params, Pagina: pagina, RegistrosPorPagina: 200 },
      json: true
    });
    if (response.Dados && response.Dados.length > 0) {
      allData = allData.concat(response.Dados);
    }
    totalPaginas = response.TotalPaginas || 1;
    if (pagina < totalPaginas) await new Promise(r => setTimeout(r, 650));
    pagina++;
  } while (pagina <= totalPaginas);
  return allData;
}

// 1. Vendas PDV com produtos (endpoint confirmado pelos workflows existentes)
const vendasPDV = await fetchAllPages.call(this, '/v1/vendaspdv/produtos', {
  DataInicial: data30DiasAtras,
  DataFinal: dataHoje,
  FiltrarPor: 0,
  Status: 1
});

await new Promise(r => setTimeout(r, 650));

// 2. Pedidos de Venda B2B (com tratamento de erro — pode não existir neste domínio)
let pedidosVenda = [];
try {
  pedidosVenda = await fetchAllPages.call(this, '/v1/pedidosvendas', {
    DataInicial: data30DiasAtras,
    DataFinal: dataHoje,
    Status: 5,
    FiltrarPor: 0
  });
} catch(e) {
  // Se retornar 404, ignorar B2B — apenas PDV será usado
  console.log('Aviso B2B: ' + e.message);
}

// produtosVendidos = dados já vêm em vendaspdv/produtos
const produtosVendidos = vendasPDV;

return [{ json: { pedidosVenda, vendasPDV, produtosVendidos, coletadoEm: new Date().toISOString() } }];`;

// ─── Novo código para Coletar Estoque ─────────────────────────────────────────
const COLETAR_ESTOQUE_CODE = `// ============================================================
// COLETAR ESTOQUE — Saldo Atual + Movimentações
// Endpoints confirmados em api.dapic.com.br
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, dataHoje, data30DiasAtras, baseUrl } = ctx;

async function fetchAllPages(endpoint, params = {}) {
  let allData = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const response = await this.helpers.httpRequest({
      method: 'GET',
      url: \`\${baseUrl}\${endpoint}\`,
      headers: { 'Authorization': \`Bearer \${token}\` },
      qs: { ...params, Pagina: pagina, RegistrosPorPagina: 200 },
      json: true
    });
    if (response.Dados && response.Dados.length > 0) {
      allData = allData.concat(response.Dados);
    }
    totalPaginas = response.TotalPaginas || 1;
    if (pagina < totalPaginas) await new Promise(r => setTimeout(r, 650));
    pagina++;
  } while (pagina <= totalPaginas);
  return allData;
}

// 1. Estoque atual — endpoint confirmado pelos workflows existentes
const estoqueAtual = await fetchAllPages.call(this, '/v1/armazenadores/produtos', {
  SaldoZerado: true
});

// 2. Movimentações dos últimos 30 dias (endpoint documentado)
await new Promise(r => setTimeout(r, 2000)); // endpoint volumoso
let movimentacoes30d = [];
try {
  movimentacoes30d = await fetchAllPages.call(this, '/v1/movimentacoesestoque', {
    DataInicial: data30DiasAtras,
    DataFinal: dataHoje
  });
} catch(e) {
  console.log('Aviso movimentações:', e.message);
}

// 3. Movimentações semana anterior
const hoje = new Date();
const inicioSemanaAtual = new Date(hoje);
inicioSemanaAtual.setDate(hoje.getDate() - hoje.getDay());
const inicioSemanaAnterior = new Date(inicioSemanaAtual);
inicioSemanaAnterior.setDate(inicioSemanaAtual.getDate() - 7);

await new Promise(r => setTimeout(r, 2000));
let movimentacoesSemanaAnterior = [];
try {
  movimentacoesSemanaAnterior = await fetchAllPages.call(this, '/v1/movimentacoesestoque', {
    DataInicial: inicioSemanaAnterior.toISOString().split('T')[0],
    DataFinal: inicioSemanaAtual.toISOString().split('T')[0]
  });
} catch(e) {
  console.log('Aviso mov. semana ant.:', e.message);
}

return [{ json: { estoqueAtual, movimentacoes30d, movimentacoesSemanaAnterior, coletadoEm: new Date().toISOString() } }];`;

async function main() {
  const { body: wf } = await api('GET', `/workflows/${WORKFLOW_ID}`);
  console.log('✅ Workflow obtido:', wf.name, '|', wf.nodes.length, 'nodes\n');

  const changes = [];

  // Atualizar Coletar Vendas
  const coletarVendas = wf.nodes.find(n => n.name === '📊 Coletar Vendas');
  if (coletarVendas) {
    coletarVendas.parameters.jsCode = COLETAR_VENDAS_CODE;
    changes.push('✅ Coletar Vendas: usando /v1/vendaspdv/produtos (confirmado) + B2B com fallback');
  }

  // Atualizar Coletar Estoque
  const coletarEstoque = wf.nodes.find(n => n.name === '📦 Coletar Estoque');
  if (coletarEstoque) {
    coletarEstoque.parameters.jsCode = COLETAR_ESTOQUE_CODE;
    changes.push('✅ Coletar Estoque: usando /v1/armazenadores/produtos (confirmado)');
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
  console.log('▶️  Reativado. Execute o workflow agora!');
}
main().catch(console.error);
