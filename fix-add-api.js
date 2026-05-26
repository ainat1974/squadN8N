/**
 * fix-add-api.js
 * 1. Atualiza Salvar JSONs para usar N8N Static Data (sem filesystem)
 * 2. Adiciona 3 novos nodes: GET Webhook + Code Lê Static Data + Respond to Webhook
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

// ─── Salvar JSONs: usa Static Data em vez de filesystem ──────────────────────
const SALVAR_JSONS_CODE = `// ============================================================
// SALVAR JSONs — Armazena em N8N Static Data (sem filesystem)
// Acessível via GET /webhook/erp?modulo=...
// ============================================================
const staticData = $getWorkflowStaticData('global');

let vendas = null, estoque = null, contasPagar = null, contasReceber = null, fluxoCaixa = null;

for (const item of $input.all()) {
  const { modulo, dados } = item.json;
  if (modulo === 'vendas') vendas = dados;
  if (modulo === 'estoque') estoque = dados;
  if (modulo === 'financeiro') {
    contasPagar = dados.contasPagar;
    contasReceber = dados.contasReceber;
    fluxoCaixa = dados.fluxoCaixa;
  }
}

const hoje = new Date().toISOString().split('T')[0];

// Salvar em static data (persiste entre execuções)
staticData.erp = {
  atualizadoEm: new Date().toISOString(),
  data: hoje,
  vendas,
  estoque,
  contasPagar,
  contasReceber,
  fluxoCaixa
};

const resumo = {
  receita_total: vendas?.summary?.receita_total || 0,
  volume_vendas: vendas?.summary?.volume_vendas || 0,
  ticket_medio: vendas?.summary?.ticket_medio || 0,
  skus_criticos: estoque?.summary?.skus_criticos || 0,
  skus_alerta: estoque?.summary?.skus_alerta || 0,
  valor_total_estoque: estoque?.summary?.valor_total_estoque || 0,
  total_inadimplente: contasReceber?.summary?.total_inadimplente || 0,
  saldo_liquido: contasReceber?.summary?.saldo_liquido || 0
};

console.log('✅ Static data salvo — Receita:', resumo.receita_total, '| SKUs críticos:', resumo.skus_criticos);

return [{ json: { sucesso: true, data: hoje, resumo } }];`;

// ─── Code: lê static data e retorna o módulo solicitado ──────────────────────
const API_READ_CODE = `// ============================================================
// API ERP — Lê Static Data e retorna módulo solicitado
// GET /webhook/erp?modulo=resumo|vendas|estoque|contas-pagar|contas-receber|fluxo-caixa
// ============================================================
const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const modulo = ($input.first().json.query?.modulo || 'resumo').toLowerCase();

const mapModulo = {
  'resumo':         null,
  'vendas':         erp.vendas,
  'estoque':        erp.estoque,
  'contas-pagar':   erp.contasPagar,
  'contas-receber': erp.contasReceber,
  'fluxo-caixa':    erp.fluxoCaixa
};

if (modulo === 'resumo') {
  const v = erp.vendas?.summary || {};
  const e = erp.estoque?.summary || {};
  const cr = erp.contasReceber?.summary || {};
  const cp = erp.contasPagar?.summary || {};
  return [{ json: {
    success: true,
    atualizadoEm: erp.atualizadoEm || null,
    data: erp.data || null,
    receita_total: v.receita_total || 0,
    volume_vendas: v.volume_vendas || 0,
    ticket_medio: v.ticket_medio || 0,
    receita_b2b: v.receita_b2b || 0,
    receita_pdv: v.receita_pdv || 0,
    skus_criticos: e.skus_criticos || 0,
    skus_alerta: e.skus_alerta || 0,
    valor_total_estoque: e.valor_total_estoque || 0,
    total_inadimplente: cr.total_inadimplente || 0,
    saldo_liquido: cr.saldo_liquido || 0,
    total_pendente_cr: cr.total_pendente || 0,
    total_pendente_cp: cp.total_pendente || 0,
    total_vencido_cp: cp.total_vencido || 0
  }}];
}

if (!(modulo in mapModulo)) {
  return [{ json: { success: false, error: 'Módulo inválido: ' + modulo, modulos: Object.keys(mapModulo) } }];
}

if (!mapModulo[modulo]) {
  return [{ json: { success: false, error: 'Dados ainda não coletados para: ' + modulo, atualizadoEm: erp.atualizadoEm || null } }];
}

return [{ json: { success: true, atualizadoEm: erp.atualizadoEm, data: erp.data, dados: mapModulo[modulo] } }];`;

async function main() {
  const { body: wf } = await api('GET', `/workflows/${WORKFLOW_ID}`);
  console.log('✅ Workflow:', wf.name, '|', wf.nodes.length, 'nodes\n');

  // ── 1. Atualizar Salvar JSONs ──────────────────────────────────────────────
  const salvarNode = wf.nodes.find(n => n.name === '💾 Salvar JSONs');
  if (salvarNode) {
    salvarNode.parameters.jsCode = SALVAR_JSONS_CODE;
    console.log('✅ Salvar JSONs: atualizado para usar Static Data');
  }

  // ── 2. Verificar se API webhook já existe ────────────────────────────────
  const jaTemWebhook = wf.nodes.find(n => n.name === '📡 API GET /erp');

  if (jaTemWebhook) {
    console.log('ℹ️  Webhooks de API já existem — apenas atualizando código');
    const readNode = wf.nodes.find(n => n.name === '📡 Ler Dados ERP');
    if (readNode) readNode.parameters.jsCode = API_READ_CODE;
  } else {
    console.log('➕ Adicionando 3 novos nodes para API GET /erp...');

    // Node 1: Webhook trigger GET /erp
    wf.nodes.push({
      id: 'api-webhook-erp',
      name: '📡 API GET /erp',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [464, 560],
      parameters: {
        httpMethod: 'GET',
        path: 'erp',
        responseMode: 'responseNode',
        options: {}
      },
      webhookId: 'erp-data-api'
    });

    // Node 2: Code node que lê static data
    wf.nodes.push({
      id: 'api-read-static',
      name: '📡 Ler Dados ERP',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [704, 560],
      parameters: { jsCode: API_READ_CODE }
    });

    // Node 3: Respond to Webhook
    wf.nodes.push({
      id: 'api-respond',
      name: '📡 Responder API',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [944, 560],
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
        options: {
          responseHeaders: {
            entries: [
              { name: 'Access-Control-Allow-Origin', value: '*' },
              { name: 'Cache-Control', value: 'no-cache' }
            ]
          }
        }
      }
    });

    // Conexões dos novos nodes
    wf.connections['📡 API GET /erp'] = {
      main: [[{ node: '📡 Ler Dados ERP', type: 'main', index: 0 }]]
    };
    wf.connections['📡 Ler Dados ERP'] = {
      main: [[{ node: '📡 Responder API', type: 'main', index: 0 }]]
    };

    console.log('✅ 3 nodes adicionados: Webhook GET + Code + Respond');
  }

  // ── 3. Salvar ─────────────────────────────────────────────────────────────
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

  console.log('🌐 API disponível em:');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=resumo');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=vendas');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=estoque');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=contas-pagar');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=contas-receber');
  console.log('   GET https://workflows.tmrodrigues.tech/webhook/erp?modulo=fluxo-caixa');
}
main().catch(console.error);
