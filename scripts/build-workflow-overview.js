// ============================================================
// scripts/build-workflow-overview.js
// Workflow INDEPENDENTE da pagina "Visao Geral" (landing de decisao).
// LEVE: sem GPT. Coleta deterministica + tendencias (periodo anterior)
// + Central de Prioridades calculada por limiares.
//
// Coleta:  POST /webhook/coletar-overview { dataInicial, dataFinal }
// Leitura: GET  /webhook/dados-overview
// staticData isolado: staticData.overview
// ============================================================
const fs = require('fs');
const path = require('path');
const {
  PREPARAR_CONTEXTO,
  COLETAR_VENDAS,
  TRANSFORMAR_VENDAS,
  COLETAR_ESTOQUE,
  TRANSFORMAR_ESTOQUE,
  COLETAR_FINANCEIRO,
  TRANSFORMAR_FINANCEIRO,
} = require('./lib/dapic-blocks');

const OUT = path.join('squads', 'n8n-erp-dashboard', 'output', 'workflow-overview.json');
const MAX_DIAS = 90;

// Periodo + janela anterior de mesmo tamanho (para setas de variacao).
const DEFINIR_PERIODO = `const input = $input.first().json || {};
const body = input.body || input.json || input;
const MAX = ${MAX_DIAS};
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());
const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };

let dataInicial = String(body.dataInicial || body.DataInicial || hoje).slice(0, 10);
let dataFinal = String(body.dataFinal || body.DataFinal || hoje).slice(0, 10);
if (dataInicial > dataFinal) { const t = dataInicial; dataInicial = dataFinal; dataFinal = t; }

let dias = Math.floor((new Date(dataFinal + 'T12:00:00') - new Date(dataInicial + 'T12:00:00')) / 86400000) + 1;
let limiteAplicado = false;
if (dias > MAX) { dataInicial = addDays(dataFinal, -(MAX - 1)); dias = MAX; limiteAplicado = true; }

const dataFinalAnterior = addDays(dataInicial, -1);
const dataInicialAnterior = addDays(dataFinalAnterior, -(dias - 1));

return [{ json: {
  dataInicial, dataFinal, dataHoje: hoje,
  dataInicialAnterior, dataFinalAnterior,
  janelaColeta: dataInicial === dataFinal ? 'dia' : 'intervalo',
  diasIntervalo: dias, limiteAplicado, maxDias: MAX
} }];`;

// Contexto carregando tambem a janela anterior.
const PREPARAR_CONTEXTO_OV = `const auth = $('🔐 Autenticar Dapic').first().json;
const periodo = $('Definir Periodo').first().json;
const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
if (!token) { throw new Error('Falha na autenticacao Dapic: access_token nao retornado'); }
return [{ json: {
  token,
  dataHoje: periodo.dataHoje,
  dataInicial: periodo.dataInicial,
  dataFinal: periodo.dataFinal,
  dataInicialAnterior: periodo.dataInicialAnterior,
  dataFinalAnterior: periodo.dataFinalAnterior,
  janelaColeta: periodo.janelaColeta || 'intervalo',
  diasIntervalo: periodo.diasIntervalo || 1,
  limiteAplicado: periodo.limiteAplicado || false,
  maxDias: periodo.maxDias || ${MAX_DIAS},
  baseUrl: 'https://api.dapic.com.br',
  iniciadoEm: new Date().toISOString()
} }];`;

// Coleta LEVE do periodo anterior: apenas totais de vendas + caixa recebido.
const COLETAR_ANTERIOR = `const ctx = $('Preparar Contexto').first().json;
const { baseUrl } = ctx;
let currentToken = ctx.token;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST', url: baseUrl + '/autenticacao/v1/login',
    headers: { 'Content-Type': 'application/json' },
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO }, json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token (anterior)');
  currentToken = auth.access_token;
}
async function request(endpoint, params = {}, retry401 = true) {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await this.helpers.httpRequest({ method: 'GET', url: baseUrl + endpoint, headers: { Authorization: 'Bearer ' + currentToken }, qs: params, json: true });
    } catch (err) {
      const status = err.httpCode || err.statusCode || err.response?.statusCode;
      if (status === 401 && retry401) { await refreshToken.call(this); return request.call(this, endpoint, params, false); }
      if ((status === 429 || status >= 500) && i < delays.length) { await sleep(delays[i]); continue; }
      throw err;
    }
  }
}
async function fetchAll(endpoint, params = {}, maxPaginas = Infinity) {
  const all = []; let pagina = 1; let totalPaginas = 1;
  do {
    const resp = await request.call(this, endpoint, { ...params, Pagina: pagina, RegistrosPorPagina: 200 });
    if (Array.isArray(resp?.Dados)) all.push(...resp.Dados);
    totalPaginas = Math.min(Number(resp?.TotalPaginas || 1), maxPaginas);
    if (pagina < totalPaginas) await sleep(250);
    pagina++;
  } while (pagina <= totalPaginas);
  return all;
}
const addDays = (iso, d) => { const x = new Date(iso + 'T12:00:00'); x.setDate(x.getDate() + d); return x.toISOString().slice(0, 10); };
const toNum = (v) => Number(v || 0) || 0;

const ini = ctx.dataInicialAnterior;
const fim = ctx.dataFinalAnterior;

// Vendas anteriores (totais), em blocos de 7 dias.
let receita = 0; const vendasIds = new Set(); let linhas = 0;
try {
  let cursor = ini;
  while (cursor <= fim) {
    let chunkEnd = addDays(cursor, 6);
    if (chunkEnd > fim) chunkEnd = fim;
    const parte = await fetchAll.call(this, '/v1/vendaspdv/produtos', { DataInicial: cursor, DataFinal: chunkEnd, FiltrarPor: 0, Status: 1 });
    for (const l of parte) {
      receita += toNum(l.ValorLiquido ?? l.ValorTotal ?? l.ValorBruto ?? l.Valor);
      const idv = l.IdVenda ?? l.Id ?? l.IdPdv;
      if (idv) vendasIds.add(String(idv));
      linhas++;
    }
    cursor = addDays(chunkEnd, 1);
    if (cursor <= fim) await sleep(400);
  }
} catch (e) { console.log('Vendas anteriores indisponivel: ' + (e.message || e)); }

// Caixa recebido anterior (pagamentos).
let caixaAnterior = 0;
try {
  const pagamentos = await fetchAll.call(this, '/v1/contas/pagamentos', { DataInicial: ini, DataFinal: fim }, 40);
  for (const pg of pagamentos) { if (pg.Cancelado) continue; caixaAnterior += toNum(pg.ValorPago ?? pg.Valor); }
} catch (e) { console.log('Caixa anterior indisponivel: ' + (e.message || e)); }

const volume = vendasIds.size || linhas;
return [{ json: {
  vendasAnterior: { receita: Math.round(receita * 100) / 100, volume },
  caixaAnterior: Math.round(caixaAnterior * 100) / 100,
  periodo: { inicio: ini, fim }
} }];`;

// Monta o payload da landing: KPIs (com variacao), prioridades, saude, graficos, tabelas.
const MONTAR_RESUMO = `const ctx = $('Preparar Contexto').first().json;
let vendas = {}, estoque = {}, fin = {}, ant = {};
try { vendas = $('Transformar Vendas').first().json.dados || {}; } catch (e) {}
try { estoque = $('Transformar Estoque').first().json.dados || {}; } catch (e) {}
try { fin = $('Transformar Financeiro').first().json || {}; } catch (e) {}
try { ant = $('Coletar Anterior').first().json || {}; } catch (e) {}

const num = (v) => Number(v || 0) || 0;
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const pct = (a, b) => (b > 0 ? round(((a - b) / b) * 100) : null);
const fmt = (v) => Number(v || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const vs = vendas.summary || {};
const es = estoque.summary || {};
const cr = (fin.contasReceber && fin.contasReceber.summary) || {};
const fc = (fin.fluxoCaixa && fin.fluxoCaixa.summary) || {};
const topDev = (fin.contasReceber && fin.contasReceber.top_devedores) || [];

const receita = num(vs.receita_total);
const ticket = num(vs.ticket_medio);
const volume = num(vs.volume_vendas);
const caixaRecebido = num(fc.pagamentos_realizados);
const aReceber = num(cr.total_aberto);
const vencido = num(cr.total_vencido);
const pctVencido = aReceber > 0 ? round((vencido / aReceber) * 100) : 0;
const skusCriticos = num(es.skus_criticos);
const skusAlerta = num(es.skus_alerta);
const valorEstoque = num(es.valor_total_estoque);

const receitaAnt = num(ant.vendasAnterior && ant.vendasAnterior.receita);
const volumeAnt = num(ant.vendasAnterior && ant.vendasAnterior.volume);
const ticketAnt = volumeAnt > 0 ? receitaAnt / volumeAnt : 0;
const caixaAnt = num(ant.caixaAnterior);

const trends = {
  receita: pct(receita, receitaAnt),
  ticket: pct(ticket, ticketAnt),
  volume: pct(volume, volumeAnt),
  caixa: pct(caixaRecebido, caixaAnt)
};

const kpis = [
  { id: 'receita', label: 'Receita do periodo', valor: receita, formato: 'moeda', variacao: trends.receita, tom: trends.receita == null ? 'muted' : (trends.receita >= 0 ? 'positivo' : 'critico') },
  { id: 'ticket', label: 'Ticket medio', valor: ticket, formato: 'moeda', variacao: trends.ticket, tom: trends.ticket == null ? 'muted' : (trends.ticket >= 0 ? 'positivo' : 'atencao') },
  { id: 'caixa', label: 'Caixa recebido', valor: caixaRecebido, formato: 'moeda', variacao: trends.caixa, tom: trends.caixa == null ? 'muted' : (trends.caixa >= 0 ? 'positivo' : 'critico') },
  { id: 'inadimplencia', label: 'Inadimplencia', valor: vencido, formato: 'moeda', detalhe: pctVencido + '% do a receber', tom: pctVencido > 0 ? (pctVencido > 50 ? 'critico' : 'atencao') : 'positivo' },
  { id: 'estoque', label: 'Estoque critico', valor: skusCriticos, formato: 'numero', detalhe: skusAlerta + ' em alerta · snapshot', tom: skusCriticos > 0 ? 'critico' : (skusAlerta > 0 ? 'atencao' : 'positivo') }
];

const prioridades = [];
const addP = (severidade, peso, categoria, titulo, valor, conteudo, link) => prioridades.push({ severidade, peso, categoria, titulo, valor, conteudo, link });

if (vencido > 0) {
  addP(pctVencido > 50 ? 'critico' : 'atencao', pctVencido > 50 ? 100 : 70, 'Inadimplencia',
    pctVencido + '% dos recebiveis vencidos', 'R$ ' + fmt(vencido),
    'Ha R$ ' + fmt(vencido) + ' vencido de R$ ' + fmt(aReceber) + ' a receber. Priorize a regua de cobranca.', '/financeiro');
}
if (topDev[0] && aReceber > 0) {
  const share = round((num(topDev[0].valor) / aReceber) * 100);
  if (share >= 40) addP(share >= 60 ? 'critico' : 'atencao', share >= 60 ? 90 : 60, 'Concentracao de carteira',
    share + '% do a receber em um cliente', String(topDev[0].cliente || topDev[0].pessoa || ''),
    'Risco concentrado em ' + (topDev[0].cliente || 'um cliente') + '. Monitore de perto.', '/insights-financeiro');
}
if (skusCriticos > 0) {
  addP(skusCriticos >= 20 ? 'critico' : 'atencao', skusCriticos >= 20 ? 85 : 55, 'Ruptura de estoque',
    skusCriticos + ' SKUs criticos', skusCriticos + ' SKUs',
    skusCriticos + ' variacoes com estoque <= 2 unidades. Risco de perder venda por ruptura.', '/estoque');
}
if (trends.receita != null && trends.receita < -10) {
  addP(trends.receita < -25 ? 'critico' : 'atencao', trends.receita < -25 ? 80 : 50, 'Vendas',
    'Receita caiu ' + Math.abs(trends.receita) + '% vs periodo anterior', 'R$ ' + fmt(receita),
    'A receita do intervalo esta abaixo do periodo anterior. Investigue mix de produtos e sazonalidade.', '/vendas');
}
if (prioridades.length === 0) {
  addP('ok', 0, 'Tudo sob controle', 'Sem alertas criticos no periodo', '',
    'Os principais indicadores estao dentro do esperado para o intervalo analisado.', '/visao-geral');
}
const prioridadesOrd = prioridades.sort((a, b) => b.peso - a.peso).slice(0, 6);

const saudeVendas = (trends.receita != null && trends.receita < -25) ? 'critico' : ((trends.receita != null && trends.receita < -10) ? 'atencao' : 'ok');
const saudeFin = pctVencido > 50 ? 'critico' : (pctVencido > 0 ? 'atencao' : 'ok');
const saudeEstoque = skusCriticos >= 20 ? 'critico' : ((skusCriticos > 0 || skusAlerta > 0) ? 'atencao' : 'ok');

const saude = {
  vendas: { status: saudeVendas, ancora: 'R$ ' + fmt(receita), detalhe: volume + ' vendas no periodo', link: '/vendas' },
  financeiro: { status: saudeFin, ancora: 'R$ ' + fmt(caixaRecebido) + ' recebido', detalhe: pctVencido + '% vencido', link: '/financeiro' },
  estoque: { status: saudeEstoque, ancora: skusCriticos + ' criticos', detalhe: 'R$ ' + fmt(valorEstoque) + ' em estoque', link: '/estoque' }
};

return [{ json: {
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  periodoAnterior: { inicio: ctx.dataInicialAnterior, fim: ctx.dataFinalAnterior },
  janelaColeta: ctx.janelaColeta,
  limiteAplicado: ctx.limiteAplicado || false,
  maxDias: ctx.maxDias || ${MAX_DIAS},
  gerado_em: new Date().toISOString(),
  kpis,
  prioridades: prioridadesOrd,
  saude,
  trends,
  graficos: {
    receita_diaria: vendas.evolucao_diaria || [],
    top_produtos: (vendas.top_produtos || []).slice(0, 10),
    top_clientes: (vendas.top_clientes || []).slice(0, 10),
    caixa: { recebido: caixaRecebido, a_receber: aReceber, projecao: (fin.fluxoCaixa && fin.fluxoCaixa.projecao_4_semanas) || [] }
  },
  tabelas: {
    estoque_atencao: (estoque.linhas || []).filter(l => l.vendido_hoje > 0 || l.estoque_atual <= 5).slice(0, 30),
    parcelas_proximas: ((fin.contasReceber && fin.contasReceber.vencendo_7d) || []).slice(0, 10)
  }
} }];`;

const SALVAR_OVERVIEW = `const staticData = $getWorkflowStaticData('global');
const resumo = $('Montar Resumo').first().json;
const atualizadoEm = new Date().toISOString();
staticData.overview = { ...resumo, atualizadoEm };
return [{ json: { sucesso: true, dataInicial: resumo.dataInicial, dataFinal: resumo.dataFinal, atualizadoEm } }];`;

const LER_OVERVIEW = `const staticData = $getWorkflowStaticData('global');
const snap = staticData.overview || null;
if (!snap) {
  return [{ json: { success: false, error: 'Nenhuma coleta da Visao Geral ainda. Selecione o intervalo e clique em Atualizar.' } }];
}
return [{ json: { success: true, ...snap } }];`;

const authNode = {
  parameters: {
    method: 'POST',
    url: 'https://api.dapic.com.br/autenticacao/v1/login',
    sendBody: true,
    bodyParameters: {
      parameters: [
        { name: 'Empresa', value: '={{ $vars.DAPIC_EMPRESA }}' },
        { name: 'TokenIntegracao', value: '={{ $vars.DAPIC_TOKEN_INTEGRACAO }}' },
      ],
    },
    options: { retry: { enabled: true, maxRetries: 3, retryInterval: 1000 } },
  },
  id: 'auth-dapic',
  name: '🔐 Autenticar Dapic',
  type: 'n8n-nodes-base.httpRequest',
  typeVersion: 4.2,
  position: [720, 400],
  retryOnFail: true,
  maxTries: 3,
  waitBetweenTries: 1000,
};

const code = (id, name, jsCode, position, extra = {}) => ({
  parameters: { jsCode }, id, name, type: 'n8n-nodes-base.code', typeVersion: 2, position, ...extra,
});

const workflow = {
  name: 'Tech Malhas - Visao Geral',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'coletar-overview', responseMode: 'onReceived', options: {} },
      id: 'trigger-webhook', name: 'Webhook Coletar', type: 'n8n-nodes-base.webhook', typeVersion: 1.1,
      position: [240, 400], webhookId: 'overview-coletar',
      notes: 'POST /webhook/coletar-overview body: { dataInicial, dataFinal }',
    },
    code('definir-periodo', 'Definir Periodo', DEFINIR_PERIODO, [480, 400]),
    authNode,
    code('preparar-contexto', 'Preparar Contexto', PREPARAR_CONTEXTO_OV, [960, 400]),
    code('coletar-vendas', 'Coletar Vendas PDV', COLETAR_VENDAS, [1200, 400]),
    code('transformar-vendas', 'Transformar Vendas', TRANSFORMAR_VENDAS, [1440, 400]),
    code('coletar-estoque', 'Coletar Estoque', COLETAR_ESTOQUE, [1680, 400], { continueOnFail: true, notes: 'Snapshot atual' }),
    code('transformar-estoque', 'Transformar Estoque', TRANSFORMAR_ESTOQUE, [1920, 400], { continueOnFail: true }),
    code('coletar-financeiro', 'Coletar Financeiro', COLETAR_FINANCEIRO, [2160, 400], { continueOnFail: true }),
    code('transformar-financeiro', 'Transformar Financeiro', TRANSFORMAR_FINANCEIRO, [2400, 400], { continueOnFail: true }),
    code('coletar-anterior', 'Coletar Anterior', COLETAR_ANTERIOR, [2640, 400], { continueOnFail: true, notes: 'Totais do periodo anterior para variacao' }),
    code('montar-resumo', 'Montar Resumo', MONTAR_RESUMO, [2880, 400]),
    code('salvar-overview', 'Salvar Overview', SALVAR_OVERVIEW, [3120, 400]),
    {
      parameters: { httpMethod: 'GET', path: 'dados-overview', responseMode: 'responseNode', options: {} },
      id: 'api-webhook', name: 'API GET /dados', type: 'n8n-nodes-base.webhook', typeVersion: 1.1,
      position: [240, 720], webhookId: 'overview-dados',
    },
    code('api-read-static', 'Ler Overview', LER_OVERVIEW, [480, 720]),
    {
      parameters: {
        respondWith: 'json', responseBody: '={{ $json }}',
        options: {
          responseHeaders: {
            entries: [
              { name: 'Access-Control-Allow-Origin', value: '*' },
              { name: 'Access-Control-Allow-Methods', value: 'GET, OPTIONS' },
              { name: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization' },
              { name: 'Cache-Control', value: 'no-cache' },
            ],
          },
        },
      },
      id: 'api-respond', name: 'Responder API', type: 'n8n-nodes-base.respondToWebhook', typeVersion: 1, position: [720, 720],
    },
  ],
  connections: {
    'Webhook Coletar': { main: [[{ node: 'Definir Periodo', type: 'main', index: 0 }]] },
    'Definir Periodo': { main: [[{ node: '🔐 Autenticar Dapic', type: 'main', index: 0 }]] },
    '🔐 Autenticar Dapic': { main: [[{ node: 'Preparar Contexto', type: 'main', index: 0 }]] },
    'Preparar Contexto': { main: [[{ node: 'Coletar Vendas PDV', type: 'main', index: 0 }]] },
    'Coletar Vendas PDV': { main: [[{ node: 'Transformar Vendas', type: 'main', index: 0 }]] },
    'Transformar Vendas': { main: [[{ node: 'Coletar Estoque', type: 'main', index: 0 }]] },
    'Coletar Estoque': { main: [[{ node: 'Transformar Estoque', type: 'main', index: 0 }]] },
    'Transformar Estoque': { main: [[{ node: 'Coletar Financeiro', type: 'main', index: 0 }]] },
    'Coletar Financeiro': { main: [[{ node: 'Transformar Financeiro', type: 'main', index: 0 }]] },
    'Transformar Financeiro': { main: [[{ node: 'Coletar Anterior', type: 'main', index: 0 }]] },
    'Coletar Anterior': { main: [[{ node: 'Montar Resumo', type: 'main', index: 0 }]] },
    'Montar Resumo': { main: [[{ node: 'Salvar Overview', type: 'main', index: 0 }]] },
    'API GET /dados': { main: [[{ node: 'Ler Overview', type: 'main', index: 0 }]] },
    'Ler Overview': { main: [[{ node: 'Responder API', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1', saveManualExecutions: true, timezone: 'America/Sao_Paulo', executionTimeout: 480 },
  pinData: {},
  meta: { version: '1.0.0', scope: 'overview-landing', builtAt: new Date().toISOString() },
  tags: [{ name: 'erp' }, { name: 'dapic' }, { name: 'tech-malhas' }, { name: 'overview' }],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('✅ Workflow Visao Geral gerado:', OUT);
console.log('   Nodes:', workflow.nodes.length);
