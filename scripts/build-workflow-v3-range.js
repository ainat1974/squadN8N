/**
 * Gera workflow N8N v3 — coleta sob demanda por intervalo (sem cron).
 * Saída: squads/n8n-erp-dashboard/output/workflow-n8n-v3-range.json
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join('squads', 'n8n-erp-dashboard', 'output', 'workflow-n8n-v3-range.json');

const DEFINIR_PERIODO = `const input = $input.first().json || {};
const body = input.body || input.json || input;
const hoje = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(new Date());

let dataInicial = String(body.dataInicial || body.DataInicial || hoje).slice(0, 10);
let dataFinal = String(body.dataFinal || body.DataFinal || hoje).slice(0, 10);

if (dataInicial > dataFinal) {
  const tmp = dataInicial;
  dataInicial = dataFinal;
  dataFinal = tmp;
}

const start = new Date(dataInicial + 'T12:00:00');
const end = new Date(dataFinal + 'T12:00:00');
let dias = Math.floor((end - start) / 86400000) + 1;
if (dias > 90) {
  const limited = new Date(end);
  limited.setDate(limited.getDate() - 89);
  dataInicial = limited.toISOString().slice(0, 10);
  dias = 90;
}

return [{ json: {
  dataInicial,
  dataFinal,
  dataHoje: hoje,
  janelaColeta: dataInicial === dataFinal ? 'dia' : 'intervalo',
  diasIntervalo: dias
} }];`;

const PREPARAR_CONTEXTO = `const auth = $('🔐 Autenticar Dapic').first().json;
const periodo = $('Definir Periodo').first().json;

const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
if (!token) {
  throw new Error('Falha na autenticacao Dapic: access_token nao retornado');
}

return [{
  json: {
    token,
    dataHoje: periodo.dataHoje,
    dataInicial: periodo.dataInicial,
    dataFinal: periodo.dataFinal,
    janelaColeta: periodo.janelaColeta || 'intervalo',
    diasIntervalo: periodo.diasIntervalo || 1,
    baseUrl: 'https://api.dapic.com.br',
    iniciadoEm: new Date().toISOString()
  }
}];`;

const COLETAR_VENDAS = `const ctx = $('Preparar Contexto').first().json;
const { dataInicial, dataFinal, baseUrl } = ctx;
let currentToken = ctx.token;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/autenticacao/v1/login',
    headers: { 'Content-Type': 'application/json' },
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO },
    json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token');
  currentToken = auth.access_token;
}

async function request(endpoint, params = {}, retry401 = true) {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await this.helpers.httpRequest({
        method: 'GET',
        url: baseUrl + endpoint,
        headers: { Authorization: 'Bearer ' + currentToken },
        qs: params,
        json: true
      });
    } catch (err) {
      const status = err.httpCode || err.statusCode || err.response?.statusCode;
      if (status === 401 && retry401) {
        await refreshToken.call(this);
        return request.call(this, endpoint, params, false);
      }
      if ((status === 429 || status >= 500) && i < delays.length) {
        await sleep(delays[i]);
        continue;
      }
      throw err;
    }
  }
}

async function fetchAll(endpoint, params = {}) {
  const all = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const resp = await request.call(this, endpoint, { ...params, Pagina: pagina, RegistrosPorPagina: 200 });
    if (Array.isArray(resp?.Dados)) all.push(...resp.Dados);
    totalPaginas = Number(resp?.TotalPaginas || 1);
    if (pagina < totalPaginas) await sleep(250);
    pagina++;
  } while (pagina <= totalPaginas);
  return all;
}

function addDays(iso, days) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

const produtosVendidos = [];
let cursor = dataInicial;
while (cursor <= dataFinal) {
  let chunkEnd = addDays(cursor, 6);
  if (chunkEnd > dataFinal) chunkEnd = dataFinal;
  const parte = await fetchAll.call(this, '/v1/vendaspdv/produtos', {
    DataInicial: cursor,
    DataFinal: chunkEnd,
    FiltrarPor: 0,
    Status: 1
  });
  produtosVendidos.push(...parte);
  cursor = addDays(chunkEnd, 1);
  if (cursor <= dataFinal) await sleep(400);
}

return [{ json: {
  produtosVendidos,
  totalLinhas: produtosVendidos.length,
  dataInicial,
  dataFinal,
  coletadoEm: new Date().toISOString()
} }];`;

const TRANSFORMAR_VENDAS = `const { produtosVendidos, dataInicial, dataFinal } = $('Coletar Vendas PDV').first().json;
const ctx = $('Preparar Contexto').first().json;

const pick = (obj, ...keys) => {
  for (const k of keys) {
    if (obj && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
};

const toNum = (v) => Number(v || 0) || 0;
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

const mapaProdutos = new Map();
const mapaDia = new Map();
let receitaTotal = 0;
let itensTotais = 0;
const vendasIds = new Set();

const isoDia = (raw) => {
  if (!raw) return dataInicial;
  const s = String(raw);
  if (/^\\d{4}-\\d{2}-\\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? dataInicial : d.toISOString().slice(0, 10);
};

for (const linha of produtosVendidos) {
  const codigo = String(pick(linha, 'Referencia', 'CodigoProduto', 'Codigo', 'Sku', 'SKU', 'IdProduto') ?? '').trim() || 'SEM-CODIGO';
  const nome = String(pick(linha, 'Produto', 'Descricao', 'NomeProduto', 'Nome') ?? 'Produto sem descricao').trim();
  const quantidade = toNum(pick(linha, 'Quantidade', 'Qtd', 'QuantidadeVendida'));
  const valorTotal = toNum(pick(linha, 'ValorLiquido', 'ValorTotal', 'ValorBruto', 'Valor'));
  const valorUnitario = toNum(pick(linha, 'ValorUnitario', 'PrecoUnitario', 'Preco'));
  const idVenda = pick(linha, 'IdVenda', 'Id', 'IdPdv');
  const dia = isoDia(pick(linha, 'DataVenda', 'Data', 'DataEmissao', 'DataMovimento'));

  if (idVenda) vendasIds.add(String(idVenda));
  receitaTotal += valorTotal;
  itensTotais += quantidade;

  const chave = codigo + '|' + nome;
  const atual = mapaProdutos.get(chave) || {
    codigo, produto: nome, quantidade: 0, valor_total: 0, valor_unitario_medio: 0, ocorrencias: 0
  };
  atual.quantidade += quantidade;
  atual.valor_total += valorTotal;
  atual.ocorrencias += 1;
  if (valorUnitario > 0) {
    atual.valor_unitario_medio = atual.valor_unitario_medio === 0
      ? valorUnitario
      : (atual.valor_unitario_medio + valorUnitario) / 2;
  }
  mapaProdutos.set(chave, atual);

  const diaAgg = mapaDia.get(dia) || { data: dia, receita: 0, volume: new Set() };
  diaAgg.receita += valorTotal;
  if (idVenda) diaAgg.volume.add(String(idVenda));
  mapaDia.set(dia, diaAgg);
}

const produtos = Array.from(mapaProdutos.values())
  .map(p => ({
    codigo: p.codigo,
    produto: p.produto,
    quantidade: round(p.quantidade),
    valor_unitario_medio: round(p.valor_unitario_medio || (p.quantidade > 0 ? p.valor_total / p.quantidade : 0)),
    valor_total: round(p.valor_total)
  }))
  .sort((a, b) => b.valor_total - a.valor_total);

const volumeVendas = vendasIds.size || produtosVendidos.length;
const ticketMedio = volumeVendas > 0 ? receitaTotal / volumeVendas : 0;

const evolucao_diaria = Array.from(mapaDia.values())
  .sort((a, b) => a.data.localeCompare(b.data))
  .map(d => ({
    data: d.data,
    receita: round(d.receita),
    volume: d.volume.size || 0
  }));

const relatorio = {
  gerado_em: new Date().toISOString(),
  janela: ctx.janelaColeta || 'intervalo',
  data: dataFinal,
  periodo: { inicio: dataInicial, fim: dataFinal, dias: ctx.diasIntervalo || evolucao_diaria.length || 1 },
  summary: {
    receita_total: round(receitaTotal),
    volume_vendas: volumeVendas,
    ticket_medio: round(ticketMedio),
    total_itens: round(itensTotais),
    total_skus: produtos.length,
    receita_pdv: round(receitaTotal),
    receita_b2b: 0
  },
  produtos_vendidos: produtos,
  top_produtos: produtos.slice(0, 10),
  evolucao_diaria,
  top_clientes: [],
  por_representante: []
};

return [{ json: { modulo: 'vendas', dados: relatorio } }];`;

const COLETAR_ESTOQUE = `const ctx = $('Preparar Contexto').first().json;
const { baseUrl } = ctx;
let currentToken = ctx.token;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/autenticacao/v1/login',
    headers: { 'Content-Type': 'application/json' },
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO },
    json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token');
  currentToken = auth.access_token;
}

async function request(endpoint, params = {}, retry401 = true) {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await this.helpers.httpRequest({
        method: 'GET',
        url: baseUrl + endpoint,
        headers: { Authorization: 'Bearer ' + currentToken },
        qs: params,
        json: true
      });
    } catch (err) {
      const status = err.httpCode || err.statusCode || err.response?.statusCode;
      if (status === 401 && retry401) {
        await refreshToken.call(this);
        return request.call(this, endpoint, params, false);
      }
      if ((status === 429 || status >= 500) && i < delays.length) {
        await sleep(delays[i]);
        continue;
      }
      throw err;
    }
  }
}

async function fetchAll(endpoint, params = {}, maxPaginas = Infinity) {
  const all = [];
  let pagina = 1;
  let totalPaginas = 1;
  do {
    const resp = await request.call(this, endpoint, { ...params, Pagina: pagina, RegistrosPorPagina: 200 });
    if (Array.isArray(resp?.Dados)) all.push(...resp.Dados);
    totalPaginas = Math.min(Number(resp?.TotalPaginas || 1), maxPaginas);
    if (pagina < totalPaginas) await sleep(250);
    pagina++;
  } while (pagina <= totalPaginas);
  return all;
}

// Nesta instancia da Dapic apenas /v1/armazenadores/produtos responde.
// /v1/estoques e /v1/estoques/todos retornam 404 (confirmado via probe).
const MAX_PAGINAS_ESTOQUE = 60; // ~12k linhas: teto de seguranca contra runaway
let estoqueAtual = [];
try {
  estoqueAtual = await fetchAll.call(this, '/v1/armazenadores/produtos', { SaldoZerado: true }, MAX_PAGINAS_ESTOQUE);
} catch (err) {
  console.log('Estoque indisponivel em /v1/armazenadores/produtos: ' + (err.message || err));
}

return [{ json: { estoqueAtual, coletadoEm: new Date().toISOString() } }];`;

const TRANSFORMAR_ESTOQUE = `const { estoqueAtual } = $('Coletar Estoque').first().json;

const toNum = (v) => Number(v || 0) || 0;
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

// codigo vem embutido no Produto: "02038412076801 - BABY LOOK COTTON PREMIUM"
const extrairCodigo = (produto) => {
  const partes = String(produto || '').split(' - ');
  return partes.length > 1 ? partes[0].trim() : '';
};
// nome limpo (sem o codigo na frente)
const limparNome = (produto) => {
  const partes = String(produto || '').split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(produto || '').trim();
};
// cor "5377 - OFF" -> "OFF"
const limparCor = (cor) => {
  if (!cor) return null;
  const partes = String(cor).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(cor).trim();
};

// 1) Mapa de vendas do periodo por variacao (IdProduto|Cor|Tamanho)
const vendidoPorVariacao = new Map();
try {
  const raw = $('Coletar Vendas PDV').first().json.produtosVendidos || [];
  for (const v of raw) {
    const chave = [v.IdProduto, v.Cor, v.Tamanho].join('|');
    vendidoPorVariacao.set(chave, (vendidoPorVariacao.get(chave) || 0) + toNum(v.Quantidade));
  }
} catch (e) {
  // sem dados de vendas no fluxo: segue sem cruzar
}

// 2) Agrega estoque por variacao somando entre armazens
const mapa = new Map();
for (const item of (estoqueAtual || [])) {
  const chave = [item.IdProduto, item.Cor, item.Tamanho].join('|');
  const valorUnit = toNum(item.ValorCusto ?? item.ValorUnitario ?? item.Valor ?? item.Preco);
  const atual = mapa.get(chave);
  if (atual) {
    atual.estoque_atual += toNum(item.Quantidade ?? item.QuantidadeReal ?? item.Saldo);
    if (!atual.valor_unitario && valorUnit) atual.valor_unitario = valorUnit;
  } else {
    mapa.set(chave, {
      codigo: extrairCodigo(item.Produto),
      produto: limparNome(item.Produto) || 'Produto',
      cor: limparCor(item.Cor),
      tamanho: item.Tamanho != null ? String(item.Tamanho).trim() : null,
      estoque_atual: toNum(item.Quantidade ?? item.QuantidadeReal ?? item.Saldo),
      vendido_hoje: vendidoPorVariacao.get(chave) || 0,
      valor_unitario: valorUnit
    });
  }
}

const linhas = Array.from(mapa.values()).sort((a, b) => b.vendido_hoje - a.vendido_hoje || a.estoque_atual - b.estoque_atual);

const valor_total_estoque = linhas.reduce((acc, l) => acc + l.estoque_atual * l.valor_unitario, 0);
const skus_criticos = linhas.filter(l => l.estoque_atual <= 2).length;
const skus_alerta = linhas.filter(l => l.estoque_atual <= 5 && l.estoque_atual > 2).length;
const total_vendido_hoje = linhas.reduce((acc, l) => acc + l.vendido_hoje, 0);

const dados = {
  gerado_em: new Date().toISOString(),
  summary: {
    total_skus: linhas.length,
    skus_criticos,
    skus_alerta,
    total_vendido_hoje: round(total_vendido_hoje),
    valor_total_estoque: round(valor_total_estoque)
  },
  linhas,
  saldo_dia: linhas
};

return [{ json: { modulo: 'estoque', dados } }];`;

const SALVAR_RELATORIO = `const staticData = $getWorkflowStaticData('global');
const ctx = $('Preparar Contexto').first().json;
const vendas = $('Transformar Vendas').first().json.dados;

let estoque = { gerado_em: new Date().toISOString(), summary: { total_skus: 0, skus_criticos: 0, skus_alerta: 0, valor_total_estoque: 0 }, linhas: [], saldo_dia: [] };
try {
  estoque = $('Transformar Estoque').first().json.dados || estoque;
} catch (e) {
  console.log('Estoque nao coletado nesta execucao — seguindo com vendas apenas');
}
const atualizadoEm = new Date().toISOString();

if (!staticData.erp) staticData.erp = {};

staticData.erp.ultimaConsulta = {
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  atualizadoEm,
  dataExecucao: ctx.dataHoje,
  janelaColeta: ctx.janelaColeta,
  vendas,
  estoque
};

staticData.erp.vendas = vendas;
staticData.erp.estoque = estoque;
staticData.erp.data = ctx.dataFinal;
staticData.erp.dataInicial = ctx.dataInicial;
staticData.erp.dataFinal = ctx.dataFinal;
staticData.erp.dataExecucao = ctx.dataHoje;
staticData.erp.janelaColeta = ctx.janelaColeta;
staticData.erp.atualizadoEm = atualizadoEm;
staticData.erp.ultimaColetaManual = atualizadoEm;
staticData.erp.fonteUltimaColeta = 'webhook';

return [{ json: {
  sucesso: true,
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  atualizadoEm,
  resumo: vendas.summary,
  total_skus: vendas.produtos_vendidos?.length || 0
} }];`;

const LER_DADOS_ERP = `const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const query = $input.first().json.query || {};
const modulo = String(query.modulo || 'resumo').toLowerCase();

const consulta = erp.ultimaConsulta || {};
const vendas = consulta.vendas || erp.vendas || null;
const estoque = consulta.estoque || erp.estoque || null;
const financeiro = erp.financeiro || null;
const contasPagar = erp.contasPagar || null;
const contasReceber = erp.contasReceber || null;
const fluxoCaixa = erp.fluxoCaixa || null;
const insights = erp.insights || null;

const meta = {
  atualizadoEm: consulta.atualizadoEm || erp.atualizadoEm || null,
  data: consulta.dataFinal || erp.data || null,
  dataInicial: consulta.dataInicial || erp.dataInicial || null,
  dataFinal: consulta.dataFinal || erp.dataFinal || null,
  dataExecucao: consulta.dataExecucao || erp.dataExecucao || null,
  janelaColeta: consulta.janelaColeta || erp.janelaColeta || 'intervalo',
  periodo: vendas?.periodo || null
};

if (modulo === 'resumo') {
  const s = vendas?.summary || {};
  const e = estoque?.summary || {};
  const cr = contasReceber?.summary || {};
  const cp = contasPagar?.summary || {};
  const fin = financeiro?.summary || {};
  return [{ json: {
    success: true,
    ...meta,
    receita_total: s.receita_total || 0,
    volume_vendas: s.volume_vendas || 0,
    ticket_medio: s.ticket_medio || 0,
    total_itens: s.total_itens || 0,
    total_skus: s.total_skus || 0,
    receita_pdv: s.receita_pdv || 0,
    receita_b2b: s.receita_b2b || 0,
    skus_criticos: e.skus_criticos || 0,
    skus_alerta: e.skus_alerta || 0,
    valor_total_estoque: e.valor_total_estoque || 0,
    total_inadimplente: cr.total_inadimplente || fin.total_vencido || 0,
    saldo_liquido: cr.saldo_liquido || fin.saldo || round((fin.total_pagamentos_d1 || 0) - (fin.total_aberto || 0)),
    total_pendente_cr: cr.total_pendente || 0,
    total_pendente_cp: cp.total_pendente || 0,
    total_vencido_cp: cp.total_vencido || 0,
    ultimaColetaManual: erp.ultimaColetaManual || meta.atualizadoEm
  } }];
}

function wrap(dados, extra = {}) {
  if (!dados) {
    return { success: false, error: 'Dados ainda nao coletados para: ' + modulo, atualizadoEm: meta.atualizadoEm };
  }
  return { success: true, atualizadoEm: meta.atualizadoEm, data: meta.data, ...meta, dados, ...extra };
}

function round(v) { return Math.round((Number(v) || 0) * 100) / 100; }

if (modulo === 'vendas') return [{ json: wrap(vendas) }];
if (modulo === 'estoque') return [{ json: wrap(estoque) }];

if (modulo === 'contas-pagar') {
  const dados = financeiro || contasPagar;
  return [{ json: dados ? wrap({
    ...dados,
    summary: {
      total_pendente: dados.summary?.total_aberto || dados.summary?.total_pendente || 0,
      total_vencido: dados.summary?.total_vencido || 0,
      total_pago: dados.summary?.total_pagamentos_d1 || dados.summary?.total_pago || 0
    },
    vencidos: dados.vencidas || dados.vencidos || [],
    vencendo_7d: dados.vencendo_7d || []
  }) : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: meta.atualizadoEm } }];
}

if (modulo === 'contas-receber') {
  const dados = financeiro || contasReceber;
  const withAliases = (items = []) => items.map(item => ({
    ...item,
    cliente: item.cliente || item.pessoa || 'Pessoa nao informada',
    valor: item.valor ?? item.valor_aberto ?? 0
  }));
  return [{ json: dados ? wrap({
    ...dados,
    summary: {
      total_pendente: dados.summary?.total_aberto || dados.summary?.total_pendente || 0,
      total_inadimplente: dados.summary?.total_vencido || dados.summary?.total_inadimplente || 0,
      total_recebendo_7d: dados.summary?.total_vencendo_7d || 0,
      saldo_liquido: dados.summary?.saldo_liquido || 0
    },
    inadimplentes: withAliases(dados.vencidas || dados.inadimplentes || []),
    recebendo_7d: withAliases(dados.vencendo_7d || [])
  }) : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: meta.atualizadoEm } }];
}

if (modulo === 'fluxo-caixa') {
  const dados = fluxoCaixa || financeiro;
  const pago = dados?.summary?.pagamentos_realizados || dados?.summary?.total_pagamentos_d1 || 0;
  const aberto = dados?.summary?.aberto_previsto || dados?.summary?.total_aberto || 0;
  return [{ json: wrap({
    summary: { pagamentos_realizados: pago, aberto_previsto: aberto, saldo: round(pago - aberto) },
    projecao_4_semanas: dados?.projecao_4_semanas || dados?.fluxo_diario || []
  }) }];
}

if (modulo === 'insights') {
  return [{ json: insights ? wrap(insights) : { success: false, error: 'Insights ainda nao gerados', atualizadoEm: meta.atualizadoEm } }];
}

return [{ json: {
  success: false,
  error: 'Modulo invalido: ' + modulo,
  modulos: ['resumo', 'vendas', 'estoque', 'contas-pagar', 'contas-receber', 'fluxo-caixa', 'insights']
} }];`;

const workflow = {
  name: 'Tech Malhas - ERP Dashboard (Range v3)',
  nodes: [
    {
      parameters: {
        httpMethod: 'POST',
        path: 'atualizar',
        responseMode: 'onReceived',
        options: {},
      },
      id: 'trigger-webhook',
      name: 'Webhook Atualizar',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [240, 400],
      webhookId: 'tech-malhas-atualizar',
      notes: 'POST /webhook/atualizar body: { dataInicial, dataFinal } YYYY-MM-DD',
    },
    {
      parameters: { jsCode: DEFINIR_PERIODO },
      id: 'definir-periodo',
      name: 'Definir Periodo',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 400],
    },
    {
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
    },
    {
      parameters: { jsCode: PREPARAR_CONTEXTO },
      id: 'preparar-contexto',
      name: 'Preparar Contexto',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [960, 400],
    },
    {
      parameters: { jsCode: COLETAR_VENDAS },
      id: 'coletar-vendas',
      name: 'Coletar Vendas PDV',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 400],
    },
    {
      parameters: { jsCode: TRANSFORMAR_VENDAS },
      id: 'transformar-vendas',
      name: 'Transformar Vendas',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1440, 400],
    },
    {
      parameters: { jsCode: COLETAR_ESTOQUE },
      id: 'coletar-estoque',
      name: 'Coletar Estoque',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, 400],
      continueOnFail: true,
      notes: 'Snapshot atual — nao depende do intervalo; falha nao bloqueia vendas',
    },
    {
      parameters: { jsCode: TRANSFORMAR_ESTOQUE },
      id: 'transformar-estoque',
      name: 'Transformar Estoque',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1920, 400],
    },
    {
      parameters: { jsCode: SALVAR_RELATORIO },
      id: 'salvar-relatorio',
      name: 'Salvar Relatorio',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2160, 400],
    },
    {
      parameters: {},
      id: 'error-trigger',
      name: 'Error Handler',
      type: 'n8n-nodes-base.errorTrigger',
      typeVersion: 1,
      position: [2160, 600],
    },
    {
      parameters: {
        httpMethod: 'GET',
        path: 'erp',
        responseMode: 'responseNode',
        options: {},
      },
      id: 'api-webhook-erp',
      name: 'API GET /erp',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [240, 720],
      webhookId: 'erp-data-api',
    },
    {
      parameters: { jsCode: LER_DADOS_ERP },
      id: 'api-read-static',
      name: 'Ler Dados ERP',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [480, 720],
    },
    {
      parameters: {
        respondWith: 'json',
        responseBody: '={{ $json }}',
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
      id: 'api-respond',
      name: 'Responder API',
      type: 'n8n-nodes-base.respondToWebhook',
      typeVersion: 1,
      position: [720, 720],
    },
    {
      parameters: {
        content:
          '## Tech Malhas ERP v3 — Coleta por intervalo\\n\\n**Sem cron.** Coleta apenas via POST `/webhook/atualizar`.\\n\\n### Body\\n```json\\n{ \"dataInicial\": \"2026-04-01\", \"dataFinal\": \"2026-04-30\" }\\n```\\n\\n### Variaveis N8N\\n- `DAPIC_EMPRESA` = techmalhasfranca\\n- `DAPIC_TOKEN_INTEGRACAO` = (token)\\n\\n### API\\n- GET `/webhook/erp?modulo=resumo|vendas|estoque|...`\\n- Le `staticData.erp.ultimaConsulta`',
        height: 280,
        width: 420,
        color: 4,
      },
      id: 'nota-config',
      name: 'Instrucoes v3',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [240, 80],
    },
  ],
  connections: {
    'Webhook Atualizar': {
      main: [[{ node: 'Definir Periodo', type: 'main', index: 0 }]],
    },
    'Definir Periodo': {
      main: [[{ node: '🔐 Autenticar Dapic', type: 'main', index: 0 }]],
    },
    '🔐 Autenticar Dapic': {
      main: [[{ node: 'Preparar Contexto', type: 'main', index: 0 }]],
    },
    'Preparar Contexto': {
      main: [[{ node: 'Coletar Vendas PDV', type: 'main', index: 0 }]],
    },
    'Coletar Vendas PDV': {
      main: [[{ node: 'Transformar Vendas', type: 'main', index: 0 }]],
    },
    'Transformar Vendas': {
      main: [[{ node: 'Coletar Estoque', type: 'main', index: 0 }]],
    },
    'Coletar Estoque': {
      main: [[{ node: 'Transformar Estoque', type: 'main', index: 0 }]],
    },
    'Transformar Estoque': {
      main: [[{ node: 'Salvar Relatorio', type: 'main', index: 0 }]],
    },
    'API GET /erp': {
      main: [[{ node: 'Ler Dados ERP', type: 'main', index: 0 }]],
    },
    'Ler Dados ERP': {
      main: [[{ node: 'Responder API', type: 'main', index: 0 }]],
    },
  },
  active: false,
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    timezone: 'America/Sao_Paulo',
    executionTimeout: 600,
  },
  pinData: {},
  meta: {
    version: '3.0.0',
    scope: 'range-on-demand',
    builtAt: new Date().toISOString(),
  },
  tags: [{ name: 'erp' }, { name: 'dapic' }, { name: 'tech-malhas' }, { name: 'v3-range' }],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('✅ Workflow v3 gerado:', OUT);
console.log('   Nodes:', workflow.nodes.length);
