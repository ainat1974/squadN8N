/**
 * Adiciona validação automatica do cron das 06:00 ao workflow ERP.
 *
 * Mudancas:
 *  1. Salvar Relatorio: detecta trigger ($execution.mode === 'trigger' = cron;
 *     'webhook' = botao Atualizar; 'manual' = teste no editor n8n).
 *     Grava staticData.erp.lastCronRun e .lastManualRun com timestamp.
 *  2. Ler Dados ERP: modulo=resumo passa a expor ultimaColetaCron,
 *     ultimaColetaManual, fonteUltimaColeta (cron|manual|webhook).
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(
      {
        hostname: HOST,
        path: `/api/v1${path}`,
        method,
        headers: {
          'X-N8N-API-KEY': API_KEY,
          Accept: 'application/json',
          ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        },
      },
      (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => {
          try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); }
          catch { resolve({ status: res.statusCode, body: raw }); }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const SALVAR_CODE = `
const staticData = $getWorkflowStaticData('global');
if (!staticData.erp) staticData.erp = { historico: { diario: {} } };
if (!staticData.erp.historico) staticData.erp.historico = { diario: {} };
if (!staticData.erp.historico.diario) staticData.erp.historico.diario = {};

const item = $input.first().json;
const dados = item.dados || {};
const ctx = $('Preparar Contexto').first().json;
const dataColeta = ctx.dataColeta;

// Detecta a origem do disparo verificando QUAL no-trigger foi executado.
// $('NomeDoNo').first() lanca erro se o no nao foi executado nesta run.
//   - Cron Diario 06:00 → cron (gatilho automatico)
//   - Webhook Manual    → webhook (botao Atualizar do dashboard)
//   - nenhum dos dois   → manual (teste no editor n8n)
let fonte = 'manual';
try {
  $('Cron Diario 06:00').first();
  fonte = 'cron';
} catch (eCron) {
  try {
    $('Webhook Manual').first();
    fonte = 'webhook';
  } catch (eWh) {
    fonte = 'manual';
  }
}
const agora = new Date().toISOString();

staticData.erp.vendas = dados;
staticData.erp.estoque = dados.estoque_grupos_top10 || null;
staticData.erp.financeiro = dados.financeiro || null;
staticData.erp.contas_pagas = null;
staticData.erp.contas_recebidas = null;
staticData.erp.insights = dados.insights || null;
staticData.erp.data = dataColeta;
staticData.erp.dataExecucao = ctx.dataHoje;
staticData.erp.janelaColeta = ctx.janelaColeta || 'D-1';
staticData.erp.atualizadoEm = agora;
staticData.erp.fonteUltimaColeta = fonte;
if (fonte === 'cron') {
  staticData.erp.lastCronRun = agora;
} else {
  staticData.erp.lastManualRun = agora;
}

if (!staticData.erp.historico.diario[dataColeta]) staticData.erp.historico.diario[dataColeta] = { data: dataColeta };
staticData.erp.historico.diario[dataColeta].vendas = dados;
staticData.erp.historico.diario[dataColeta].estoque = dados.estoque_grupos_top10 || null;
staticData.erp.historico.diario[dataColeta].financeiro = dados.financeiro || null;
staticData.erp.historico.diario[dataColeta].contas_pagas = null;
staticData.erp.historico.diario[dataColeta].contas_recebidas = null;
staticData.erp.historico.diario[dataColeta].insights = dados.insights || null;
staticData.erp.historico.diario[dataColeta].atualizadoEm = agora;
staticData.erp.historico.diario[dataColeta].fonteUltimaColeta = fonte;

const datas = Object.keys(staticData.erp.historico.diario).sort();
while (datas.length > 120) {
  delete staticData.erp.historico.diario[datas.shift()];
}

return [{ json: {
  sucesso: true,
  data: dataColeta,
  janelaColeta: staticData.erp.janelaColeta,
  atualizadoEm: agora,
  fonteUltimaColeta: fonte,
  lastCronRun: staticData.erp.lastCronRun || null,
  lastManualRun: staticData.erp.lastManualRun || null,
  resumo: dados.summary,
  financeiro: dados.financeiro?.summary || {},
  insights: {
    alertas: (dados.insights?.alertas || []).length,
    recomendacoes: (dados.insights?.recomendacoes || []).length
  }
} }];
`;

// Bloco do modulo=resumo no Ler Dados ERP precisa expor as 3 novas chaves.
// Faco substituicao de string para nao reescrever o arquivo todo.
function patchLerDados(originalCode) {
  const marker = "if (modulo === 'resumo') {";
  const idx = originalCode.indexOf(marker);
  if (idx < 0) throw new Error('Bloco resumo nao encontrado em Ler Dados ERP');
  // localiza o `}` que fecha esse bloco — proximo `}` no nivel raiz apos `}` do return
  // Simples: substituo a primeira ocorrencia de 'qt_recomendacoes:' incluindo as chaves novas
  const oldKey = 'qt_recomendacoes: (insights?.recomendacoes || []).length';
  const newKey =
    'qt_recomendacoes: (insights?.recomendacoes || []).length,\n    ultimaColetaCron: erp.lastCronRun || null,\n    ultimaColetaManual: erp.lastManualRun || null,\n    fonteUltimaColeta: erp.fonteUltimaColeta || null';
  if (originalCode.includes('ultimaColetaCron')) {
    console.log('Ler Dados ERP ja contem ultimaColetaCron — pulando.');
    return originalCode;
  }
  if (!originalCode.includes(oldKey)) throw new Error('Marcador qt_recomendacoes nao encontrado');
  return originalCode.replace(oldKey, newKey);
}

(async () => {
  const wfRes = await request('GET', `/workflows/${WF_ID}`);
  if (wfRes.status !== 200) throw new Error('GET workflow falhou: ' + wfRes.status);
  const wf = wfRes.body;

  const salvar = wf.nodes.find((n) => n.name.includes('Salvar Relatorio'));
  if (!salvar) throw new Error('No Salvar Relatorio nao encontrado');
  salvar.parameters.jsCode = SALVAR_CODE;
  console.log('OK — Salvar Relatorio atualizado (deteta cron/webhook/manual)');

  const ler = wf.nodes.find((n) => n.name.includes('Ler Dados ERP'));
  if (!ler) throw new Error('No Ler Dados ERP nao encontrado');
  ler.parameters.jsCode = patchLerDados(ler.parameters.jsCode);
  console.log('OK — Ler Dados ERP atualizado (expoe ultimaColetaCron/Manual/fonte)');

  // settings filtrado p/ aceitar PUT
  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const k of allowed) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];

  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings };
  const put = await request('PUT', `/workflows/${WF_ID}`, payload);
  if (put.status >= 400) {
    console.error('PUT falhou:', put.status, JSON.stringify(put.body).slice(0, 600));
    process.exit(1);
  }
  console.log('OK — workflow salvo no n8n');

  // Dispara um webhook pra que erp.lastManualRun fique populado ja
  const trig = await new Promise((res) => {
    https
      .request({ hostname: HOST, path: '/webhook/atualizar', method: 'POST' }, (r) => {
        let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res({ status: r.statusCode, body: d }));
      })
      .on('error', (e) => res({ error: e.message }))
      .end();
  });
  console.log('Trigger webhook /atualizar:', trig.status || trig.error, trig.body?.slice(0, 100));
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
