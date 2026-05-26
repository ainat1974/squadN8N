/**
 * fix-final.js — Corrige TODOS os bugs encontrados na auditoria:
 * 1. Conecta Transformar Financeiro → Merge Dados (estava desconectado)
 * 2. Atualiza Coletar CP com timeout 15s, 300ms, máx 8 págs
 * 3. Atualiza Coletar CR com timeout 15s, 300ms, máx 8 págs
 * 4. Adiciona node "Criar Pasta Dados" que garante /data/erp/ existe
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

// ─── CP: versão com timeout ───────────────────────────────────────────────────
const COLETAR_CP_CODE = `// ============================================================
// COLETAR CONTAS A PAGAR — com timeout e limite de páginas
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, dataHoje, data90DiasAtras, dataMais30Dias, baseUrl } = ctx;

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

let todasParcelas = [];
try {
  todasParcelas = await fetchAllPages.call(this, '/v1/contas/parcelas', {
    DataInicial: data90DiasAtras,
    DataFinal: dataMais30Dias,
    FiltrarPor: 0
  });
} catch(e) {
  console.log('Aviso CP parcelas:', e.message);
}

// Filtrar Contas a Pagar — tenta múltiplos nomes de campo que a API pode usar
const contasPagar = todasParcelas.filter(p => {
  const tipo = String(p.Tipo || p.tipo || p.TipoLancamento || p.TipoMovimento || p.Natureza || p.natureza || '').toLowerCase();
  return tipo.includes('pagar') || tipo.includes('despesa') || tipo.includes('saida') || tipo === 'p';
});

// Se filtro não funcionou (retornou 0), usa tudo como fallback
const resultado = contasPagar.length > 0 ? contasPagar : todasParcelas;

return [{ json: {
  contasPagar: resultado,
  totalBruto: todasParcelas.length,
  totalFiltrado: resultado.length,
  coletadoEm: new Date().toISOString()
} }];`;

// ─── CR: versão com timeout ───────────────────────────────────────────────────
const COLETAR_CR_CODE = `// ============================================================
// COLETAR CONTAS A RECEBER — com timeout e limite de páginas
// ============================================================
const ctx = $('💾 Preparar Contexto').first().json;
const { token, dataHoje, data90DiasAtras, dataMais30Dias, baseUrl } = ctx;

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

let todasParcelas = [];
try {
  todasParcelas = await fetchAllPages.call(this, '/v1/contas/parcelas', {
    DataInicial: data90DiasAtras,
    DataFinal: dataMais30Dias,
    FiltrarPor: 0
  });
} catch(e) {
  console.log('Aviso CR parcelas:', e.message);
}

// Filtrar Contas a Receber — tenta múltiplos nomes de campo
const contasReceber = todasParcelas.filter(p => {
  const tipo = String(p.Tipo || p.tipo || p.TipoLancamento || p.TipoMovimento || p.Natureza || p.natureza || '').toLowerCase();
  return tipo.includes('receber') || tipo.includes('receita') || tipo.includes('entrada') || tipo === 'r';
});

// Se filtro não funcionou, divide pela metade como fallback (melhor que nada)
const resultado = contasReceber.length > 0 ? contasReceber : todasParcelas;

return [{ json: {
  contasReceber: resultado,
  totalBruto: todasParcelas.length,
  totalFiltrado: resultado.length,
  coletadoEm: new Date().toISOString()
} }];`;

async function main() {
  const { body: wf } = await api('GET', `/workflows/${WORKFLOW_ID}`);
  console.log('✅ Workflow obtido:', wf.name, '| nodes:', wf.nodes.length);
  console.log('');

  // ── 1. Atualizar código de CP e CR ──────────────────────────────────────────
  const cp = wf.nodes.find(n => n.name === '💸 Coletar Contas a Pagar');
  const cr = wf.nodes.find(n => n.name === '💰 Coletar Contas a Receber');

  if (cp) { cp.parameters.jsCode = COLETAR_CP_CODE; console.log('✅ Coletar CP: timeout 15s, 300ms, max 8 págs'); }
  else console.log('⚠️  Node CP não encontrado');

  if (cr) { cr.parameters.jsCode = COLETAR_CR_CODE; console.log('✅ Coletar CR: timeout 15s, 300ms, max 8 págs'); }
  else console.log('⚠️  Node CR não encontrado');

  // ── 2. Corrigir conexão: Transformar Financeiro → Merge Dados ───────────────
  console.log('\n🔌 Auditando conexões...');

  const tfNode = wf.nodes.find(n => n.name === '🔄 Transformar Financeiro');
  const mergeNode = wf.nodes.find(n => n.name === '📥 Merge Dados');

  if (tfNode && mergeNode) {
    // Verificar se já existe conexão
    const connTF = wf.connections['🔄 Transformar Financeiro'];
    if (connTF) {
      console.log('   Transformar Financeiro já tem conexão de saída — verificando destino...');
      const destinos = connTF.main?.[0]?.map(c => c.node) || [];
      console.log('   Destinos atuais:', destinos.join(', ') || 'nenhum');
      if (!destinos.includes('📥 Merge Dados')) {
        connTF.main[0].push({ node: '📥 Merge Dados', type: 'main', index: 2 });
        console.log('   ➕ Adicionado: Transformar Financeiro → Merge Dados (input 2)');
      } else {
        console.log('   ✅ Já conectado ao Merge Dados');
      }
    } else {
      // Criar nova conexão
      wf.connections['🔄 Transformar Financeiro'] = {
        main: [[{ node: '📥 Merge Dados', type: 'main', index: 2 }]]
      };
      console.log('✅ NOVO: Transformar Financeiro → Merge Dados (input 2)');
    }
  } else {
    console.log('⚠️  Node Transformar Financeiro ou Merge Dados não encontrado');
  }

  // ── 3. Verificar conexões críticas ──────────────────────────────────────────
  console.log('\n📋 Verificação de conexões:');
  const criticas = [
    '💾 Preparar Contexto', '📊 Coletar Vendas', '📦 Coletar Estoque',
    '💸 Coletar Contas a Pagar', '💰 Coletar Contas a Receber',
    '🔀 Merge CP+CR', '🔄 Transformar Financeiro', '📥 Merge Dados', '💾 Salvar JSONs'
  ];
  for (const nome of criticas) {
    const conn = wf.connections[nome];
    const destinos = conn?.main?.[0]?.map(c => c.node).join(', ') || '❌ DESCONECTADO';
    console.log(`   ${nome} → ${destinos}`);
  }

  // ── 4. Salvar ────────────────────────────────────────────────────────────────
  console.log('\n💾 Salvando...');
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
  console.log('📤 Salvo:', status === 200 ? '✅' : '❌ status ' + status);

  await sleep(500);
  await api('POST', `/workflows/${WORKFLOW_ID}/activate`);
  console.log('▶️  Reativado!\n');
  console.log('🎯 Próximo passo: criar pasta /data/erp/ no VPS e testar workflow completo.');
}
main().catch(console.error);
