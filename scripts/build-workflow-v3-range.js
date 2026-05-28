/**
 * Gera workflow N8N v3 — coleta sob demanda por intervalo (sem cron).
 * Saída: squads/n8n-erp-dashboard/output/workflow-n8n-v3-range.json
 */
const fs = require('fs');
const path = require('path');

const OUT = path.join('squads', 'n8n-erp-dashboard', 'output', 'workflow-n8n-v3-range.json');

// Credencial OpenAI ja existente na instancia n8n (reutilizada pelos agentes IA)
const OPENAI_CRED_ID = 'cCFxJ8gcTdB3fTEk';
const OPENAI_CRED_NAME = 'OpenAI account';

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

const COLETAR_FINANCEIRO = `const ctx = $('Preparar Contexto').first().json;
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
  if (!auth.access_token) throw new Error('Falha ao renovar token (financeiro)');
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

function addDiasIso(iso, dias) {
  const d = new Date(iso + 'T12:00:00');
  d.setDate(d.getDate() + dias);
  return d.toISOString().slice(0, 10);
}

const hoje = ctx.dataHoje;

// Contas a Receber: parcelas por VENCIMENTO (FiltrarPor=1) numa janela ampla
// para aging (passado) + projecao (futuro). Teto de 40 paginas (~8k parcelas).
const recIni = addDiasIso(hoje, -120);
const recFim = addDiasIso(hoje, 60);
let parcelas = [];
try {
  parcelas = await fetchAll.call(this, '/v1/contas/parcelas', { DataInicial: recIni, DataFinal: recFim, FiltrarPor: 1 }, 40);
} catch (e) {
  console.log('Parcelas (contas a receber) indisponivel: ' + (e.message || e));
}

// Entradas realizadas de caixa: pagamentos no intervalo escolhido (fallback 30d)
const pagIni = ctx.dataInicial || addDiasIso(hoje, -30);
const pagFim = ctx.dataFinal || hoje;
let pagamentos = [];
try {
  pagamentos = await fetchAll.call(this, '/v1/contas/pagamentos', { DataInicial: pagIni, DataFinal: pagFim }, 40);
} catch (e) {
  console.log('Pagamentos (entradas) indisponivel: ' + (e.message || e));
}

return [{ json: { parcelas, pagamentos, hoje, recIni, recFim, pagIni, pagFim, coletadoEm: new Date().toISOString() } }];`;

const TRANSFORMAR_FINANCEIRO = `const fin = $('Coletar Financeiro').first().json;
const parcelas = fin.parcelas || [];
const pagamentos = fin.pagamentos || [];
const hoje = fin.hoje;

const toNum = (v) => Number(v || 0) || 0;
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const diaDe = (s) => String(s || '').slice(0, 10);
const addDiasIso = (iso, dias) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + dias); return d.toISOString().slice(0, 10); };
// dias de atraso: >0 vencido, <0 ainda vai vencer
const atrasoDe = (venc) => {
  const a = new Date(hoje + 'T00:00:00');
  const b = new Date(diaDe(venc) + 'T00:00:00');
  return Math.round((a - b) / 86400000);
};

// Parcelas em aberto (ignora canceladas; considera Aberta ou com ValorAberto > 0)
const abertas = parcelas.filter(p => {
  const s = String(p.Status || '').toLowerCase();
  if (s === 'cancelada' || s === 'perdida') return false;
  return s === 'aberta' || toNum(p.ValorAberto) > 0;
});

let total_aberto = 0, total_vencido = 0, total_a_vencer = 0;
const aging = { a_vencer: 0, d1_30: 0, d31_60: 0, d61_90: 0, d90_plus: 0 };
const porPessoa = new Map();
const vencidasArr = [];
const vencendo7dArr = [];
const projWeeks = [0, 0, 0, 0];

for (const p of abertas) {
  const valor = toNum(p.ValorAberto || p.ValorFinal || p.Valor);
  if (valor <= 0) continue;
  const venc = diaDe(p.DataVencimento);
  const atraso = atrasoDe(venc);
  const pessoa = String(p.Pessoa || '').trim() || 'Cliente nao informado';
  const reg = {
    id: p.IdParcela,
    cliente: pessoa,
    pessoa,
    valor: round(valor),
    valor_aberto: round(valor),
    data_vencimento: venc,
    dias_atraso: atraso > 0 ? atraso : 0,
    conta: p.Conta || null,
    forma_pagamento: p.FormaPagamento || null
  };
  total_aberto += valor;

  if (atraso > 0) {
    total_vencido += valor;
    vencidasArr.push(reg);
    if (atraso <= 30) aging.d1_30 += valor;
    else if (atraso <= 60) aging.d31_60 += valor;
    else if (atraso <= 90) aging.d61_90 += valor;
    else aging.d90_plus += valor;
  } else {
    total_a_vencer += valor;
    aging.a_vencer += valor;
    if (atraso >= -7) vencendo7dArr.push(reg);
    const diasAteVencer = -atraso;
    const wi = Math.floor(diasAteVencer / 7);
    if (wi >= 0 && wi < 4) projWeeks[wi] += valor;
  }

  const acc = porPessoa.get(pessoa) || { cliente: pessoa, pessoa, valor: 0, vencido: 0 };
  acc.valor += valor;
  if (atraso > 0) acc.vencido += valor;
  porPessoa.set(pessoa, acc);
}

vencidasArr.sort((a, b) => b.valor - a.valor);
vencendo7dArr.sort((a, b) => a.data_vencimento.localeCompare(b.data_vencimento));
const top_devedores = Array.from(porPessoa.values())
  .map(x => ({ ...x, valor: round(x.valor), vencido: round(x.vencido) }))
  .sort((a, b) => b.vencido - a.vencido || b.valor - a.valor)
  .slice(0, 10);
const total_vencendo_7d = vencendo7dArr.reduce((s, r) => s + r.valor, 0);

// Entradas realizadas (pagamentos = recebimentos efetivados)
let pagamentos_realizados = 0;
const serieDia = new Map();
for (const pg of pagamentos) {
  if (pg.Cancelado) continue;
  const v = toNum(pg.ValorPago || pg.Valor);
  if (v <= 0) continue;
  pagamentos_realizados += v;
  const d = diaDe(pg.DataPagamento);
  serieDia.set(d, (serieDia.get(d) || 0) + v);
}
const serie_entradas = Array.from(serieDia.entries())
  .sort((a, b) => a[0].localeCompare(b[0]))
  .map(([data, valor]) => ({ data, valor: round(valor) }));

const projecao_4_semanas = projWeeks.map((v, i) => ({
  semana: 'Sem ' + (i + 1),
  periodo: addDiasIso(hoje, i * 7) + '..' + addDiasIso(hoje, i * 7 + 6),
  entradas_previstas: round(v),
  saidas_previstas: 0,
  saldo_semana: round(v)
}));

const gerado_em = new Date().toISOString();

const contasReceber = {
  gerado_em,
  summary: {
    total_aberto: round(total_aberto),
    total_pendente: round(total_aberto),
    total_vencido: round(total_vencido),
    total_inadimplente: round(total_vencido),
    total_a_vencer: round(total_a_vencer),
    total_vencendo_7d: round(total_vencendo_7d),
    saldo_liquido: round(pagamentos_realizados),
    qt_aberto: abertas.length,
    qt_vencido: vencidasArr.length
  },
  aging: {
    a_vencer: round(aging.a_vencer),
    d1_30: round(aging.d1_30),
    d31_60: round(aging.d31_60),
    d61_90: round(aging.d61_90),
    d90_plus: round(aging.d90_plus)
  },
  vencidas: vencidasArr.slice(0, 50),
  inadimplentes: vencidasArr.slice(0, 50),
  vencendo_7d: vencendo7dArr.slice(0, 50),
  recebendo_7d: vencendo7dArr.slice(0, 50),
  top_devedores
};

// Contas a Pagar: nao disponivel nesta instancia da Dapic.
const contasPagar = {
  gerado_em,
  disponivel: false,
  motivo: 'Dapic nao expoe contas a pagar/despesas classificadas nesta instancia (parcelas sem PlanoConta; /contas/pagamentos sao recebimentos de caixa).',
  summary: { total_aberto: 0, total_pendente: 0, total_vencido: 0, total_pagamentos_d1: 0, total_pago: 0 },
  vencidas: [],
  vencidos: [],
  vencendo_7d: []
};

const fluxoCaixa = {
  gerado_em,
  summary: {
    pagamentos_realizados: round(pagamentos_realizados),
    aberto_previsto: round(total_aberto),
    saldo: round(pagamentos_realizados - total_aberto)
  },
  projecao_4_semanas,
  serie_entradas,
  periodo_entradas: { inicio: fin.pagIni, fim: fin.pagFim }
};

return [{ json: { contasReceber, contasPagar, fluxoCaixa } }];`;

// ===================== AGENTE FERNANDA (FINANCEIRO) =====================
const PREPARAR_PROMPT_FERNANDA = `const ctx = $('Preparar Contexto').first().json;
const fin = $('Transformar Financeiro').first().json || {};
const cr = fin.contasReceber || { summary: {}, aging: {}, top_devedores: [] };
const fc = fin.fluxoCaixa || { summary: {}, projecao_4_semanas: [] };
let vendas = {};
try { vendas = $('Transformar Vendas').first().json.dados || {}; } catch (e) {}

const num = (v) => Number(v || 0) || 0;
const totalReceber = num(cr.summary.total_aberto);
const totalVencido = num(cr.summary.total_vencido);
const topDev = (cr.top_devedores || []).slice(0, 8);
const concentracaoTop1 = totalReceber > 0 && topDev[0] ? Math.round((num(topDev[0].valor) / totalReceber) * 1000) / 10 : 0;

const payload = {
  periodo: { inicio: ctx.dataInicial, fim: ctx.dataFinal },
  caixa: {
    entradas_realizadas: num(fc.summary.pagamentos_realizados),
    a_receber_aberto: totalReceber,
    a_receber_vencido: totalVencido
  },
  vendas: {
    receita_total: num(vendas.summary && vendas.summary.receita_total),
    ticket_medio: num(vendas.summary && vendas.summary.ticket_medio),
    volume_vendas: num(vendas.summary && vendas.summary.volume_vendas)
  },
  inadimplencia: {
    total_vencido: totalVencido,
    pct_sobre_aberto: totalReceber > 0 ? Math.round((totalVencido / totalReceber) * 1000) / 10 : 0,
    aging: cr.aging || {},
    qt_titulos_vencidos: num(cr.summary.qt_vencido),
    concentracao_top1_pct: concentracaoTop1,
    top_devedores: topDev
  },
  projecao_4_semanas: fc.projecao_4_semanas || [],
  contas_a_pagar_disponivel: false
};

const system = [
  'Voce e Fernanda, CFO/analista financeira senior da Tech Malhas (malharia em Franca/SP).',
  'NUNCA invente numeros — use APENAS os valores do JSON enviado.',
  'IMPORTANTE: contas a pagar/despesas NAO estao disponiveis nesta fonte (contas_a_pagar_disponivel=false). NAO faca afirmacoes sobre despesas, lucro ou DRE.',
  'Foque em: caixa recebido, recebiveis em aberto, inadimplencia/aging, concentracao de devedores e acoes de cobranca.',
  'Responda APENAS com um objeto JSON valido (sem markdown, sem code fences, sem texto fora do JSON).',
  'Tom: direto, objetivo, portugues BR, foco em decisao.',
  '',
  'Schema obrigatorio:',
  '{',
  '  "resumo_executivo": "2 a 3 frases com caixa recebido, total a receber e o principal risco de inadimplencia.",',
  '  "saude_financeira": "boa|atencao|critica",',
  '  "indicadores": [ { "label": "string", "valor": "string com moeda/numero", "tom": "positivo|atencao|critico" } ],',
  '  "alertas": [ { "prioridade": "alta|media|baixa", "tipo": "inadimplencia|concentracao_cliente|fluxo_caixa|outro", "titulo": "string", "detalhe": "string" } ],',
  '  "recomendacoes": [ { "prioridade": "alta|media|baixa", "acao": "cobrar|renegociar|monitorar|investigar", "cliente": "nome ou diversos", "motivo": "string", "impacto_esperado": "string" } ]',
  '}',
  '',
  'Regras: 3 a 5 indicadores, 2 a 5 alertas, 2 a 5 recomendacoes. Cite clientes concretos do top_devedores quando fizer sentido. Se faltar sinal, devolva array vazio.'
].join('\\n');

const prompt_agente = ['Dados financeiros do periodo:', JSON.stringify(payload), '', 'Gere o JSON conforme o schema do system message.'].join('\\n');

return [{ json: { prompt_agente, system_message: system, payload_ia: payload } }];`;

const PARSE_FERNANDA = `const item = $input.first().json;
const raw = item.output || item.text || item.response || '';
let ctx = {};
try { ctx = $('Preparar Prompt Fernanda').first().json.payload_ia || {}; } catch (e) {}

function tryParse(text) {
  if (!text || typeof text !== 'string') return null;
  let c = text.trim().replace(/^\\s*\`\`\`json\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').replace(/^\\s*\`\`\`\\s*/, '');
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\\{[\\s\\S]*\\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

const p = tryParse(raw);
const base = { gerado_em: new Date().toISOString(), modelo: 'gpt-4o', agente: 'Fernanda Financeiro', contexto: ctx };
const analise = (p && typeof p === 'object') ? {
  ...base,
  resumo_executivo: String(p.resumo_executivo || '').trim(),
  saude_financeira: p.saude_financeira || 'atencao',
  indicadores: Array.isArray(p.indicadores) ? p.indicadores.slice(0, 6) : [],
  alertas: Array.isArray(p.alertas) ? p.alertas.slice(0, 8) : [],
  recomendacoes: Array.isArray(p.recomendacoes) ? p.recomendacoes.slice(0, 8) : []
} : {
  ...base,
  resumo_executivo: '',
  saude_financeira: 'indisponivel',
  indicadores: [], alertas: [], recomendacoes: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 400)
};

return [{ json: { analiseFinanceira: analise } }];`;

// ===================== AGENTE PAULO (PCP) =====================
const PREPARAR_PROMPT_PAULO = `const ctx = $('Preparar Contexto').first().json;
let estoque = {};
let vendas = {};
try { estoque = $('Transformar Estoque').first().json.dados || {}; } catch (e) {}
try { vendas = $('Transformar Vendas').first().json.dados || {}; } catch (e) {}

const num = (v) => Number(v || 0) || 0;
const linhas = estoque.linhas || [];

// Candidatos a ruptura: vendeu no periodo e tem pouco estoque relativo
const risco = linhas
  .filter(l => num(l.vendido_hoje) > 0)
  .map(l => {
    const vend = num(l.vendido_hoje);
    const est = num(l.estoque_atual);
    const cobertura = vend > 0 ? Math.round((est / vend) * 10) / 10 : 999;
    return {
      codigo: l.codigo,
      produto: l.produto,
      variacao: [l.cor, l.tamanho].filter(Boolean).join(' / '),
      estoque_atual: est,
      vendido_periodo: vend,
      cobertura: cobertura
    };
  })
  .sort((a, b) => a.cobertura - b.cobertura || b.vendido_periodo - a.vendido_periodo)
  .slice(0, 25);

const payload = {
  periodo: { inicio: ctx.dataInicial, fim: ctx.dataFinal },
  estoque_summary: estoque.summary || {},
  vendas_summary: vendas.summary || {},
  top_produtos: (vendas.top_produtos || []).slice(0, 10).map(p => ({ codigo: p.codigo, produto: p.produto, quantidade: num(p.quantidade), valor_total: num(p.valor_total) })),
  variacoes_em_risco: risco
};

const system = [
  'Voce e Paulo, gerente de PCP (Planejamento e Controle da Producao) da Tech Malhas (malharia em Franca/SP).',
  'NUNCA invente numeros — use APENAS os valores do JSON enviado.',
  'Foque em: risco de ruptura (cobertura baixa x venda), reposicao/producao prioritaria, valor imobilizado em estoque e mix de produtos.',
  'cobertura = estoque_atual / vendido_periodo (em "vendas do periodo"). Cobertura baixa = risco de faltar.',
  'Responda APENAS com um objeto JSON valido (sem markdown, sem code fences, sem texto fora do JSON).',
  'Tom: direto, objetivo, portugues BR, foco em acao operacional de producao/reposicao.',
  '',
  'Schema obrigatorio:',
  '{',
  '  "resumo_executivo": "2 a 3 frases com situacao do estoque, principal risco de ruptura e valor imobilizado.",',
  '  "saude_estoque": "boa|atencao|critica",',
  '  "indicadores": [ { "label": "string", "valor": "string com numero/moeda", "tom": "positivo|atencao|critico" } ],',
  '  "reposicao_urgente": [ { "produto": "string", "codigo": "string", "variacao": "string", "estoque_atual": 0, "vendido_periodo": 0, "cobertura_dias": 0, "urgencia": "critico|alto|medio" } ],',
  '  "alertas": [ { "prioridade": "alta|media|baixa", "tipo": "ruptura_iminente|excesso_estoque|sem_giro|outro", "produto": "string", "titulo": "string", "detalhe": "string" } ],',
  '  "recomendacoes": [ { "prioridade": "alta|media|baixa", "acao": "repor|produzir|promover|reduzir_compra|investigar", "produto": "string ou diversos", "motivo": "string", "impacto_esperado": "string" } ]',
  '}',
  '',
  'Regras: 3 a 5 indicadores, ate 10 itens em reposicao_urgente (os de menor cobertura), 2 a 6 alertas, 2 a 5 recomendacoes. Cite produtos concretos. Se faltar sinal, devolva array vazio.'
].join('\\n');

const prompt_agente = ['Dados de estoque e vendas do periodo:', JSON.stringify(payload), '', 'Gere o JSON conforme o schema do system message.'].join('\\n');

return [{ json: { prompt_agente, system_message: system, payload_ia: payload } }];`;

const PARSE_PAULO = `const item = $input.first().json;
const raw = item.output || item.text || item.response || '';
let ctx = {};
try { ctx = $('Preparar Prompt Paulo').first().json.payload_ia || {}; } catch (e) {}

function tryParse(text) {
  if (!text || typeof text !== 'string') return null;
  let c = text.trim().replace(/^\\s*\`\`\`json\\s*/i, '').replace(/\\s*\`\`\`\\s*$/i, '').replace(/^\\s*\`\`\`\\s*/, '');
  try { return JSON.parse(c); } catch (e) {}
  const m = c.match(/\\{[\\s\\S]*\\}/);
  if (m) { try { return JSON.parse(m[0]); } catch (e) {} }
  return null;
}

const p = tryParse(raw);
const base = { gerado_em: new Date().toISOString(), modelo: 'gpt-4o', agente: 'Paulo PCP', contexto: ctx };
const analise = (p && typeof p === 'object') ? {
  ...base,
  resumo_executivo: String(p.resumo_executivo || '').trim(),
  saude_estoque: p.saude_estoque || 'atencao',
  indicadores: Array.isArray(p.indicadores) ? p.indicadores.slice(0, 6) : [],
  reposicao_urgente: Array.isArray(p.reposicao_urgente) ? p.reposicao_urgente.slice(0, 10) : [],
  alertas: Array.isArray(p.alertas) ? p.alertas.slice(0, 8) : [],
  recomendacoes: Array.isArray(p.recomendacoes) ? p.recomendacoes.slice(0, 8) : []
} : {
  ...base,
  resumo_executivo: '',
  saude_estoque: 'indisponivel',
  indicadores: [], reposicao_urgente: [], alertas: [], recomendacoes: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 400)
};

return [{ json: { analisePCP: analise } }];`;

const SALVAR_RELATORIO = `const staticData = $getWorkflowStaticData('global');
const ctx = $('Preparar Contexto').first().json;
const vendas = $('Transformar Vendas').first().json.dados;

let estoque = { gerado_em: new Date().toISOString(), summary: { total_skus: 0, skus_criticos: 0, skus_alerta: 0, valor_total_estoque: 0 }, linhas: [], saldo_dia: [] };
try {
  estoque = $('Transformar Estoque').first().json.dados || estoque;
} catch (e) {
  console.log('Estoque nao coletado nesta execucao — seguindo com vendas apenas');
}

let financeiro = null;
try {
  financeiro = $('Transformar Financeiro').first().json || null;
} catch (e) {
  console.log('Financeiro nao coletado nesta execucao — seguindo sem CR/fluxo');
}

let analiseFinanceira = null;
try {
  analiseFinanceira = $('Parse Fernanda').first().json.analiseFinanceira || null;
} catch (e) {
  console.log('Analise Fernanda indisponivel nesta execucao');
}
let analisePCP = null;
try {
  analisePCP = $('Parse Paulo').first().json.analisePCP || null;
} catch (e) {
  console.log('Analise Paulo indisponivel nesta execucao');
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
  estoque,
  contasReceber: financeiro?.contasReceber || null,
  contasPagar: financeiro?.contasPagar || null,
  fluxoCaixa: financeiro?.fluxoCaixa || null,
  analiseFinanceira,
  analisePCP
};

staticData.erp.analiseFinanceira = analiseFinanceira;
staticData.erp.analisePCP = analisePCP;
staticData.erp.vendas = vendas;
staticData.erp.estoque = estoque;
if (financeiro) {
  staticData.erp.contasReceber = financeiro.contasReceber;
  staticData.erp.contasPagar = financeiro.contasPagar;
  staticData.erp.fluxoCaixa = financeiro.fluxoCaixa;
  staticData.erp.financeiro = null;
}
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
const analiseFinanceira = consulta.analiseFinanceira || erp.analiseFinanceira || null;
const analisePCP = consulta.analisePCP || erp.analisePCP || null;

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
    resumo_financeiro_ia: analiseFinanceira?.resumo_executivo || null,
    resumo_pcp_ia: analisePCP?.resumo_executivo || null,
    qt_alertas_ia: (analiseFinanceira?.alertas?.length || 0) + (analisePCP?.alertas?.length || 0),
    qt_recomendacoes_ia: (analiseFinanceira?.recomendacoes?.length || 0) + (analisePCP?.recomendacoes?.length || 0),
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

if (modulo === 'financeiro-ia') {
  return [{ json: analiseFinanceira ? wrap(analiseFinanceira) : { success: false, error: 'Analise da Fernanda ainda nao gerada', atualizadoEm: meta.atualizadoEm } }];
}

if (modulo === 'pcp-ia') {
  return [{ json: analisePCP ? wrap(analisePCP) : { success: false, error: 'Analise do Paulo ainda nao gerada', atualizadoEm: meta.atualizadoEm } }];
}

if (modulo === 'insights') {
  if (!analiseFinanceira && !analisePCP) {
    return [{ json: { success: false, error: 'Analises de IA ainda nao geradas', atualizadoEm: meta.atualizadoEm } }];
  }
  return [{ json: wrap({ financeiro: analiseFinanceira, pcp: analisePCP }) }];
}

return [{ json: {
  success: false,
  error: 'Modulo invalido: ' + modulo,
  modulos: ['resumo', 'vendas', 'estoque', 'contas-pagar', 'contas-receber', 'fluxo-caixa', 'financeiro-ia', 'pcp-ia', 'insights']
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
      parameters: { jsCode: COLETAR_FINANCEIRO },
      id: 'coletar-financeiro',
      name: 'Coletar Financeiro',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2160, 400],
      continueOnFail: true,
      notes: 'Contas a Receber (parcelas) + entradas (pagamentos); falha nao bloqueia vendas/estoque',
    },
    {
      parameters: { jsCode: TRANSFORMAR_FINANCEIRO },
      id: 'transformar-financeiro',
      name: 'Transformar Financeiro',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2400, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PREPARAR_PROMPT_FERNANDA },
      id: 'preparar-prompt-fernanda',
      name: 'Preparar Prompt Fernanda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2640, 400],
      notes: 'Monta payload financeiro enxuto + system prompt para a Fernanda.',
    },
    {
      parameters: {
        model: { __rl: true, value: 'gpt-4o', mode: 'list' },
        options: { temperature: 0.2, responseFormat: 'json_object' },
      },
      id: 'openai-fernanda',
      name: 'OpenAI Fernanda (gpt-4o)',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.2,
      position: [2640, 600],
      credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.prompt_agente }}',
        options: { systemMessage: '={{ $json.system_message }}' },
      },
      id: 'agente-fernanda',
      name: 'Fernanda Financeiro',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [2820, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PARSE_FERNANDA },
      id: 'parse-fernanda',
      name: 'Parse Fernanda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3000, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PREPARAR_PROMPT_PAULO },
      id: 'preparar-prompt-paulo',
      name: 'Preparar Prompt Paulo',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3180, 400],
      notes: 'Monta payload de estoque/vendas + system prompt para o Paulo.',
    },
    {
      parameters: {
        model: { __rl: true, value: 'gpt-4o', mode: 'list' },
        options: { temperature: 0.2, responseFormat: 'json_object' },
      },
      id: 'openai-paulo',
      name: 'OpenAI Paulo (gpt-4o)',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.2,
      position: [3180, 600],
      credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
    },
    {
      parameters: {
        promptType: 'define',
        text: '={{ $json.prompt_agente }}',
        options: { systemMessage: '={{ $json.system_message }}' },
      },
      id: 'agente-paulo',
      name: 'Paulo PCP',
      type: '@n8n/n8n-nodes-langchain.agent',
      typeVersion: 1.7,
      position: [3360, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PARSE_PAULO },
      id: 'parse-paulo',
      name: 'Parse Paulo',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3540, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: SALVAR_RELATORIO },
      id: 'salvar-relatorio',
      name: 'Salvar Relatorio',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [3720, 400],
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
      main: [[{ node: 'Coletar Financeiro', type: 'main', index: 0 }]],
    },
    'Coletar Financeiro': {
      main: [[{ node: 'Transformar Financeiro', type: 'main', index: 0 }]],
    },
    'Transformar Financeiro': {
      main: [[{ node: 'Preparar Prompt Fernanda', type: 'main', index: 0 }]],
    },
    'Preparar Prompt Fernanda': {
      main: [[{ node: 'Fernanda Financeiro', type: 'main', index: 0 }]],
    },
    'OpenAI Fernanda (gpt-4o)': {
      ai_languageModel: [[{ node: 'Fernanda Financeiro', type: 'ai_languageModel', index: 0 }]],
    },
    'Fernanda Financeiro': {
      main: [[{ node: 'Parse Fernanda', type: 'main', index: 0 }]],
    },
    'Parse Fernanda': {
      main: [[{ node: 'Preparar Prompt Paulo', type: 'main', index: 0 }]],
    },
    'Preparar Prompt Paulo': {
      main: [[{ node: 'Paulo PCP', type: 'main', index: 0 }]],
    },
    'OpenAI Paulo (gpt-4o)': {
      ai_languageModel: [[{ node: 'Paulo PCP', type: 'ai_languageModel', index: 0 }]],
    },
    'Paulo PCP': {
      main: [[{ node: 'Parse Paulo', type: 'main', index: 0 }]],
    },
    'Parse Paulo': {
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
