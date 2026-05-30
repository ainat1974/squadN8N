// ============================================================
// scripts/lib/dapic-blocks.js
// Fonte UNICA dos blocos de codigo (Code nodes) reutilizados pelos
// workflows por pagina. Cada per-page generator importa daqui para
// evitar duplicacao/divergencia de logica (auth, paginacao, datas,
// coleta/transformacao financeira).
//
// Convencao de nomes de nos (mantida igual entre workflows para que
// os blocos $('Nome do No') funcionem sem alteracao):
//   - 'Definir Periodo'
//   - '🔐 Autenticar Dapic'
//   - 'Preparar Contexto'
//   - 'Coletar Financeiro'
//   - 'Transformar Financeiro'
// ============================================================

const MAX_DIAS = 90; // ~3 meses: teto explicito de intervalo

// Valida o intervalo recebido no body do webhook e aplica o teto de 90 dias.
// Expoe `limiteAplicado` para que a resposta possa avisar o usuario quando
// o intervalo pedido foi recortado.
const DEFINIR_PERIODO = `const input = $input.first().json || {};
const body = input.body || input.json || input;
const MAX = ${MAX_DIAS};
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
let limiteAplicado = false;
if (dias > MAX) {
  const limited = new Date(end);
  limited.setDate(limited.getDate() - (MAX - 1));
  dataInicial = limited.toISOString().slice(0, 10);
  dias = MAX;
  limiteAplicado = true;
}

return [{ json: {
  dataInicial,
  dataFinal,
  dataHoje: hoje,
  janelaColeta: dataInicial === dataFinal ? 'dia' : 'intervalo',
  diasIntervalo: dias,
  limiteAplicado,
  maxDias: MAX
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
    limiteAplicado: periodo.limiteAplicado || false,
    maxDias: periodo.maxDias || ${MAX_DIAS},
    baseUrl: 'https://api.dapic.com.br',
    iniciadoEm: new Date().toISOString()
  }
}];`;

// Coleta recebiveis (parcelas) com vencimento no intervalo e entradas de
// caixa realizadas (pagamentos) no intervalo. Identica ao bloco do v3.
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

// Contas a Receber: parcelas com VENCIMENTO no intervalo SELECIONADO
// (FiltrarPor=1). Analise pontual: recebiveis cujo vencimento cai no periodo.
// O atraso e sempre medido em relacao a HOJE (dado de posicao atual).
const recIni = ctx.dataInicial || addDiasIso(hoje, -30);
const recFim = ctx.dataFinal || hoje;
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

// Transforma parcelas/pagamentos em contasReceber + fluxoCaixa. Identica ao v3.
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

// Projecao por MEDIA MOVEL das entradas realizadas.
const diasJanela = Math.max(1, Math.round((new Date(fin.pagFim + 'T00:00:00') - new Date(fin.pagIni + 'T00:00:00')) / 86400000) + 1);
const media_diaria_entradas = round(pagamentos_realizados / diasJanela);
const media_semanal_entradas = round(media_diaria_entradas * 7);

const projecao_4_semanas = [0, 1, 2, 3].map((i) => {
  const recebiveis_a_vencer = round(projWeeks[i]);
  const base_media = media_semanal_entradas;
  const entradas_previstas = round(base_media + recebiveis_a_vencer);
  return {
    semana: 'Sem ' + (i + 1),
    periodo: addDiasIso(hoje, i * 7) + '..' + addDiasIso(hoje, i * 7 + 6),
    entradas_previstas,
    base_media,
    recebiveis_a_vencer,
    saidas_previstas: 0,
    saldo_semana: entradas_previstas
  };
});

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

const fluxoCaixa = {
  gerado_em,
  metodo_projecao: 'media_movel_entradas_realizadas',
  summary: {
    pagamentos_realizados: round(pagamentos_realizados),
    aberto_previsto: round(total_aberto),
    saldo: round(pagamentos_realizados - total_aberto),
    media_diaria_entradas,
    media_semanal_entradas,
    dias_janela: diasJanela,
    projecao_4_semanas_total: round(projecao_4_semanas.reduce((s, w) => s + w.entradas_previstas, 0))
  },
  projecao_4_semanas,
  serie_entradas,
  periodo_entradas: { inicio: fin.pagIni, fim: fin.pagFim }
};

return [{ json: { contasReceber, fluxoCaixa } }];`;

// Coleta vendas PDV do intervalo, em blocos de 7 dias (anti-timeout). Identica ao v3.
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
const mapaClientes = new Map();
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
  const cliente = String(pick(linha, 'Pessoa', 'NomePessoa', 'NomeCliente', 'Cliente') ?? '').trim() || 'Consumidor (sem cadastro)';

  if (idVenda) vendasIds.add(String(idVenda));
  receitaTotal += valorTotal;
  itensTotais += quantidade;

  const cAtual = mapaClientes.get(cliente) || { cliente, valor_total: 0, itens: 0, vendas: new Set() };
  cAtual.valor_total += valorTotal;
  cAtual.itens += quantidade;
  if (idVenda) cAtual.vendas.add(String(idVenda));
  mapaClientes.set(cliente, cAtual);

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
  top_clientes: Array.from(mapaClientes.values())
    .map(c => ({ cliente: c.cliente, valor_total: round(c.valor_total), itens: round(c.itens), vendas: c.vendas.size }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 10),
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

const extrairCodigo = (produto) => {
  const partes = String(produto || '').split(' - ');
  return partes.length > 1 ? partes[0].trim() : '';
};
const limparNome = (produto) => {
  const partes = String(produto || '').split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(produto || '').trim();
};
const limparCor = (cor) => {
  if (!cor) return null;
  const partes = String(cor).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(cor).trim();
};

// Mapa de vendas do periodo por variacao (IdProduto|Cor|Tamanho)
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

module.exports = {
  MAX_DIAS,
  DEFINIR_PERIODO,
  PREPARAR_CONTEXTO,
  COLETAR_FINANCEIRO,
  TRANSFORMAR_FINANCEIRO,
  COLETAR_VENDAS,
  TRANSFORMAR_VENDAS,
  COLETAR_ESTOQUE,
  TRANSFORMAR_ESTOQUE,
};
