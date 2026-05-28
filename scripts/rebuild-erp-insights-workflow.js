/**
 * Rebuilds the live N8N ERP workflow around the desired production flow:
 * D-1 PDV sold products -> current stock for sold products -> paid/received
 * accounts -> AI insights -> static-data API for the dashboard.
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

const COMMON_DAPIC_HELPERS = `
const ctx = $('Preparar Contexto').first().json;
const baseUrl = ctx.baseUrl || 'https://api.dapic.com.br';
let token = ctx.token;
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/autenticacao/v1/login',
    headers: { 'Content-Type': 'application/json' },
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO },
    json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token Dapic');
  token = auth.access_token;
}

async function request(endpoint, params = {}, retry401 = true) {
  const delays = [1000, 2000, 4000];
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await this.helpers.httpRequest({
        method: 'GET',
        url: baseUrl + endpoint,
        headers: { Authorization: 'Bearer ' + token },
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

const pick = (obj, ...keys) => {
  for (const key of keys) {
    if (obj && obj[key] != null && obj[key] !== '') return obj[key];
  }
  return null;
};
const toNum = (v) => Number(v || 0) || 0;
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const cleanLabel = (value) => {
  if (!value) return '';
  const parts = String(value).split(' - ');
  return parts.length > 1 ? parts.slice(1).join(' - ').trim() : String(value).trim();
};
`;

const COLETAR_FINANCEIRO_DAPIC_CODE = `${COMMON_DAPIC_HELPERS}
const item = $input.first().json;
const dados = item.dados || {};
const dataColeta = ctx.dataColeta;
const hoje = new Date(ctx.dataHoje + 'T00:00:00');
const dataInicioAberto = ctx.dataColeta;
const dataFimAbertoObj = new Date(ctx.dataHoje + 'T00:00:00');
dataFimAbertoObj.setDate(dataFimAbertoObj.getDate() + 30);
const dataFimAberto = dataFimAbertoObj.toISOString().slice(0, 10);

const parcelasD1 = await fetchAll.call(this, '/v1/contas/parcelas', {
  DataInicial: dataColeta,
  DataFinal: dataColeta,
  FiltrarPor: 0
});

const parcelasAbertasJanela = await fetchAll.call(this, '/v1/contas/parcelas', {
  DataInicial: dataInicioAberto,
  DataFinal: dataFimAberto,
  FiltrarPor: 0
});

const pagamentosD1 = await fetchAll.call(this, '/v1/contas/pagamentos', {
  DataInicial: dataColeta,
  DataFinal: dataColeta
});

function normalizeParcela(p) {
  const status = String(p.Status || p.status || '');
  const dataVencimento = String(p.DataVencimento || '').slice(0, 10);
  const valor = round(toNum(p.Valor || p.ValorFinal || p.Total));
  const valorPago = round(toNum(p.ValorPago));
  const valorAberto = round(toNum(p.ValorAberto));
  const venc = dataVencimento ? new Date(dataVencimento + 'T00:00:00') : null;
  const diasAtraso = venc && valorAberto > 0 && venc < hoje
    ? Math.floor((hoje - venc) / 86400000)
    : 0;
  return {
    id_parcela: p.IdParcela || null,
    id_conta: p.IdConta || null,
    pessoa: String(p.Pessoa || 'Pessoa nao informada').trim(),
    conta: String(p.Conta || ''),
    plano_conta: p.PlanoConta || null,
    categoria: p.Categoria || null,
    forma_pagamento: p.FormaPagamento || null,
    status,
    data_emissao: String(p.DataEmissao || '').slice(0, 10) || null,
    data_vencimento: dataVencimento || null,
    parcela: p.Parcela || null,
    valor,
    valor_pago: valorPago,
    valor_aberto: valorAberto,
    dias_atraso: diasAtraso
  };
}

function normalizePagamento(p) {
  return {
    id_pagamento: p.IdPagamento || null,
    id_parcela: p.IdParcela || null,
    id_conta: p.IdConta || null,
    pessoa: String(p.Pessoa || 'Pessoa nao informada').trim(),
    conta: String(p.Conta || ''),
    plano_conta: p.PlanoConta || null,
    categoria: p.Categoria || null,
    forma_pagamento: p.FormaPagamento || null,
    data_pagamento: String(p.DataPagamento || '').slice(0, 10) || null,
    data_vencimento: String(p.DataVencimento || '').slice(0, 10) || null,
    valor: round(toNum(p.Valor || p.ValorPago)),
    valor_pago: round(toNum(p.ValorPago)),
    cancelado: Boolean(p.Cancelado),
    observacoes: p.Observacoes || null
  };
}

const parcelasD1Norm = parcelasD1.map(normalizeParcela);
const abertas = parcelasAbertasJanela.map(normalizeParcela).filter(p => p.status === 'Aberta' && p.valor_aberto > 0);
const pagasD1 = parcelasD1Norm.filter(p => p.status === 'Paga' && p.valor_pago > 0);
const abertasD1 = parcelasD1Norm.filter(p => p.status === 'Aberta' && p.valor_aberto > 0);
const pagamentos = pagamentosD1.map(normalizePagamento).filter(p => !p.cancelado);
const vencidas = abertas.filter(p => p.dias_atraso > 0).sort((a, b) => b.valor_aberto - a.valor_aberto);

const seteDias = new Date(hoje);
seteDias.setDate(seteDias.getDate() + 7);
const vencendo7d = abertas.filter(p => {
  if (!p.data_vencimento) return false;
  const venc = new Date(p.data_vencimento + 'T00:00:00');
  return venc >= hoje && venc <= seteDias;
}).sort((a, b) => b.valor_aberto - a.valor_aberto);

const fluxoMap = new Map();
for (const p of abertas) {
  const semana = p.data_vencimento || 'sem-data';
  const cur = fluxoMap.get(semana) || { data: semana, total_aberto: 0, quantidade: 0 };
  cur.total_aberto += p.valor_aberto;
  cur.quantidade += 1;
  fluxoMap.set(semana, cur);
}

const totalPagoD1 = round(pagasD1.reduce((s, p) => s + p.valor_pago, 0));
const totalPagamentosD1 = round(pagamentos.reduce((s, p) => s + p.valor_pago, 0));
const totalAberto = round(abertas.reduce((s, p) => s + p.valor_aberto, 0));
const totalVencido = round(vencidas.reduce((s, p) => s + p.valor_aberto, 0));
const totalVencendo7d = round(vencendo7d.reduce((s, p) => s + p.valor_aberto, 0));

dados.financeiro = {
  data: dataColeta,
  janela_abertos: { inicio: dataInicioAberto, fim: dataFimAberto },
  classificacao_cp_cr: 'indisponivel_na_api_parcelas',
  observacao: 'A API Dapic retornou parcelas com Status, ValorAberto e ValorPago, mas sem campo explicito Pagar/Receber. Os totais abaixo sao financeiros genericos ate que a regra de classificacao seja validada.',
  summary: {
    total_pago_d1: totalPagoD1,
    total_pagamentos_d1: totalPagamentosD1,
    qtd_pagas_d1: pagasD1.length,
    qtd_pagamentos_d1: pagamentos.length,
    total_aberto: totalAberto,
    qtd_abertas: abertas.length,
    total_aberto_d1: round(abertasD1.reduce((s, p) => s + p.valor_aberto, 0)),
    qtd_abertas_d1: abertasD1.length,
    total_vencido: totalVencido,
    qtd_vencidas: vencidas.length,
    total_vencendo_7d: totalVencendo7d,
    qtd_vencendo_7d: vencendo7d.length
  },
  parcelas_pagas_d1: pagasD1.sort((a, b) => b.valor_pago - a.valor_pago).slice(0, 100),
  pagamentos_realizados_d1: pagamentos.sort((a, b) => b.valor_pago - a.valor_pago).slice(0, 100),
  parcelas_abertas: abertas.sort((a, b) => b.valor_aberto - a.valor_aberto).slice(0, 200),
  parcelas_abertas_d1: abertasD1.sort((a, b) => b.valor_aberto - a.valor_aberto).slice(0, 100),
  vencidas: vencidas.slice(0, 100),
  vencendo_7d: vencendo7d.slice(0, 100),
  fluxo_diario: Array.from(fluxoMap.values())
    .map(x => ({ ...x, total_aberto: round(x.total_aberto) }))
    .sort((a, b) => String(a.data).localeCompare(String(b.data)))
};

return [{ json: { modulo: 'vendas', dados } }];
`;

const PREPARAR_PROMPT_IA_CODE = `
const item = $input.first().json;
const dados = item.dados || {};
const financeiro = dados.financeiro || {};

const top = (dados.top_produtos || []).slice(0, 10).map(p => ({
  codigo: p.codigo,
  produto: p.produto,
  quantidade: p.quantidade,
  valor_total: p.valor_total
}));

const grupos = ((dados.estoque_grupos_top10 || {}).grupos || []).slice(0, 8).map(g => ({
  grupo: g.grupo,
  total_produtos: g.total_produtos,
  total_vendido_hoje: g.total_vendido_hoje,
  total_estoque: g.total_estoque,
  produtos: (g.produtos || []).slice(0, 8).map(p => ({
    codigo: p.codigo,
    produto: p.produto,
    vendido_hoje: p.vendido_hoje,
    estoque_total: p.estoque_total,
    variacoes_baixas: (p.variacoes || [])
      .filter(v => Number(v.estoque) <= Math.max(5, Number(v.vendido_hoje || 0) * 2))
      .slice(0, 6)
  }))
}));

const payload = {
  data_referencia: dados.data || dados.periodo?.fim,
  janela: dados.janela || 'D-1',
  vendas_summary: dados.summary || {},
  top_produtos: top,
  estoque_summary: (dados.estoque_grupos_top10 || {}).summary || {},
  grupos_top10: grupos,
  financeiro: {
    summary: financeiro.summary || {},
    parcelas_pagas_d1: (financeiro.parcelas_pagas_d1 || []).slice(0, 10),
    pagamentos_realizados_d1: (financeiro.pagamentos_realizados_d1 || []).slice(0, 10),
    parcelas_abertas: (financeiro.parcelas_abertas || []).slice(0, 20),
    vencidas: (financeiro.vencidas || []).slice(0, 10),
    vencendo_7d: (financeiro.vencendo_7d || []).slice(0, 10),
    observacao: financeiro.observacao || null
  }
};

const system = [
  'Voce e um agente executivo de varejo de moda da Tech Malhas em Franca/SP.',
  'Sua missao e analisar os dados D-1 do ERP Dapic: produtos vendidos no PDV, estoque atual desses produtos e financeiro generico (parcelas pagas, pagamentos realizados, parcelas abertas, vencidas e vencendo).',
  'Use SOMENTE os numeros do JSON enviado. Nao invente dados.',
  'Responda somente em JSON valido, sem markdown e sem texto fora do JSON.',
  'Oriente decisoes praticas de PCP, reposicao, compras, vendas, caixa e cobranca.',
  '',
  'Schema obrigatorio:',
  '{',
  '  "resumo_executivo": "2 a 4 frases objetivas sobre vendas, estoque e financeiro do D-1.",',
  '  "destaques": [{ "titulo": "string curta", "valor": "numero/moeda/texto", "tipo": "positivo|atencao|critico" }],',
  '  "alertas": [{ "tipo": "estoque_critico|ruptura|caixa|cobranca|oportunidade|outro", "prioridade": "alta|media|baixa", "titulo": "string curta", "detalhe": "explicacao breve baseada nos dados", "produto": "opcional", "link": "/vendas|/estoque|/financeiro|/visao-geral" }],',
  '  "recomendacoes": [{ "acao": "produzir|repor|comprar|promover|cobrar|segurar_compra|investigar", "prioridade": "alta|media|baixa", "produto": "produto/grupo ou diversos", "motivo": "por que agir", "impacto_esperado": "ganho esperado", "link": "/vendas|/estoque|/financeiro" }]',
  '}',
  '',
  'Regras:',
  '- Gere 3 a 5 destaques, 3 a 8 alertas e 3 a 6 recomendacoes.',
  '- Prioridade alta apenas quando houver numero que justifique.',
  '- Sempre que possivel cite produto, grupo, valor de venda, estoque, parcelas abertas, vencidas ou pagamentos realizados.',
  '- Nao diga Contas a Pagar ou Contas a Receber como certeza: a API nao retornou campo explicito de classificacao. Use "parcelas abertas", "pagamentos realizados" e "financeiro".',
  '- Se uma area vier vazia, explique como ausencia de registros retornados, sem tratar como falha.'
].join('\\n');

const prompt_agente = [
  'Analise este snapshot D-1 do ERP Dapic e gere orientacoes executivas em JSON:',
  JSON.stringify(payload)
].join('\\n');

return [{ json: {
  modulo: 'insights',
  dados,
  prompt_agente,
  system_message: system,
  payload_ia: payload,
  chatInput: prompt_agente
} }];
`;

const PARSE_INSIGHTS_CODE = `
const item = $input.first().json;
const dados = $('Preparar Prompt IA').first().json.dados || item.dados || {};
const raw = item.output || item.text || item.response || '';

function tryParse(text) {
  if (!text || typeof text !== 'string') return null;
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^\\s*\\\`\\\`\\\`json\\s*/i, '').replace(/\\s*\\\`\\\`\\\`\\s*$/i, '');
  cleaned = cleaned.replace(/^\\s*\\\`\\\`\\\`\\s*/, '').replace(/\\s*\\\`\\\`\\\`\\s*$/, '');
  try { return JSON.parse(cleaned); } catch {}
  const m = cleaned.match(/\\{[\\s\\S]*\\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

const parsed = tryParse(raw);
const insights = parsed && typeof parsed === 'object' ? {
  gerado_em: new Date().toISOString(),
  modelo: 'gpt-4.1-mini',
  resumo_executivo: String(parsed.resumo_executivo || '').trim(),
  destaques: Array.isArray(parsed.destaques) ? parsed.destaques.slice(0, 8) : [],
  alertas: Array.isArray(parsed.alertas) ? parsed.alertas.slice(0, 12) : [],
  recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes.slice(0, 10) : []
} : {
  gerado_em: new Date().toISOString(),
  modelo: 'gpt-4.1-mini',
  resumo_executivo: '',
  destaques: [],
  alertas: [],
  recomendacoes: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 800)
};

dados.insights = insights;
return [{ json: { modulo: 'vendas', dados } }];
`;

const SALVAR_RELATORIO_CODE = `
const staticData = $getWorkflowStaticData('global');
if (!staticData.erp) staticData.erp = { historico: { diario: {} } };
if (!staticData.erp.historico) staticData.erp.historico = { diario: {} };
if (!staticData.erp.historico.diario) staticData.erp.historico.diario = {};

const item = $input.first().json;
const dados = item.dados || {};
const ctx = $('Preparar Contexto').first().json;
const dataColeta = ctx.dataColeta;

staticData.erp.vendas = dados;
staticData.erp.estoque = dados.estoque_grupos_top10 || null;
staticData.erp.financeiro = dados.financeiro || null;
staticData.erp.contas_pagas = null;
staticData.erp.contas_recebidas = null;
staticData.erp.insights = dados.insights || null;
staticData.erp.data = dataColeta;
staticData.erp.dataExecucao = ctx.dataHoje;
staticData.erp.janelaColeta = ctx.janelaColeta || 'D-1';
staticData.erp.atualizadoEm = new Date().toISOString();

if (!staticData.erp.historico.diario[dataColeta]) staticData.erp.historico.diario[dataColeta] = { data: dataColeta };
staticData.erp.historico.diario[dataColeta].vendas = dados;
staticData.erp.historico.diario[dataColeta].estoque = dados.estoque_grupos_top10 || null;
staticData.erp.historico.diario[dataColeta].financeiro = dados.financeiro || null;
staticData.erp.historico.diario[dataColeta].contas_pagas = null;
staticData.erp.historico.diario[dataColeta].contas_recebidas = null;
staticData.erp.historico.diario[dataColeta].insights = dados.insights || null;
staticData.erp.historico.diario[dataColeta].atualizadoEm = staticData.erp.atualizadoEm;

const datas = Object.keys(staticData.erp.historico.diario).sort();
while (datas.length > 120) {
  delete staticData.erp.historico.diario[datas.shift()];
}

return [{ json: {
  sucesso: true,
  data: dataColeta,
  janelaColeta: staticData.erp.janelaColeta,
  atualizadoEm: staticData.erp.atualizadoEm,
  resumo: dados.summary,
  financeiro: dados.financeiro?.summary || {},
  insights: {
    alertas: (dados.insights?.alertas || []).length,
    recomendacoes: (dados.insights?.recomendacoes || []).length
  }
} }];
`;

const API_READ_CODE = `
const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const query = $input.first().json.query || {};
const modulo = String(query.modulo || 'resumo').toLowerCase();
const dias = Math.max(1, Math.min(Number(query.dias || 1), 120));
const diario = erp.historico?.diario || {};
const datasComVendas = Object.keys(diario).filter(d => diario[d]?.vendas?.summary).sort();
const datasOrdenadas = datasComVendas.length ? datasComVendas : Object.keys(diario).sort();
const datasPeriodo = datasOrdenadas.slice(-dias);
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

function ultimoCom(campo) {
  const datas = Object.keys(diario).sort();
  for (let i = datas.length - 1; i >= 0; i--) {
    const d = diario[datas[i]];
    if (d && d[campo]) return d[campo];
  }
  return erp[campo] || null;
}

function agregarVendas() {
  const diasComVendas = datasPeriodo.map(d => ({ data: d, vendas: diario[d]?.vendas })).filter(x => x.vendas);
  if (!diasComVendas.length && erp.vendas) return erp.vendas;
  const evolucao = [];
  const produtosMap = new Map();
  let receitaTotal = 0, volumeTotal = 0, itensTotais = 0;
  for (const { data, vendas } of diasComVendas) {
    const s = vendas.summary || {};
    receitaTotal += Number(s.receita_total || 0);
    volumeTotal += Number(s.volume_vendas || 0);
    itensTotais += Number(s.total_itens || 0);
    evolucao.push({ data, receita: round(s.receita_total || 0), volume: Number(s.volume_vendas || 0) });
    for (const p of vendas.produtos_vendidos || []) {
      const chave = (p.codigo || 'SEM') + '|' + (p.produto || 'N/A');
      const cur = produtosMap.get(chave) || { codigo: p.codigo, produto: p.produto, id_produto: p.id_produto || null, quantidade: 0, valor_total: 0, valor_unitario_medio: 0 };
      cur.quantidade += Number(p.quantidade || 0);
      cur.valor_total += Number(p.valor_total || 0);
      cur.valor_unitario_medio = p.valor_unitario_medio || cur.valor_unitario_medio;
      produtosMap.set(chave, cur);
    }
  }
  const produtos = Array.from(produtosMap.values()).map(p => ({
    codigo: p.codigo,
    produto: p.produto,
    id_produto: p.id_produto,
    quantidade: round(p.quantidade),
    valor_unitario_medio: round(p.valor_unitario_medio),
    valor_total: round(p.valor_total)
  })).sort((a, b) => b.quantidade - a.quantidade);
  const ultimoDia = diasComVendas[diasComVendas.length - 1]?.vendas || {};
  return {
    gerado_em: erp.atualizadoEm || new Date().toISOString(),
    janela: erp.janelaColeta || 'D-1',
    data: ultimoDia.data || erp.data,
    periodo: { inicio: datasPeriodo[0] || erp.data || null, fim: datasPeriodo[datasPeriodo.length - 1] || erp.data || null, dias },
    summary: {
      receita_total: round(receitaTotal),
      volume_vendas: volumeTotal,
      ticket_medio: volumeTotal > 0 ? round(receitaTotal / volumeTotal) : 0,
      total_itens: round(itensTotais),
      total_skus: produtos.length,
      receita_pdv: round(receitaTotal),
      receita_b2b: 0
    },
    evolucao_diaria: evolucao,
    produtos_vendidos: produtos,
    top_produtos: produtos.slice(0, 10),
    estoque_top10: ultimoDia.estoque_top10 || erp.vendas?.estoque_top10 || [],
    estoque_top10_linhas: ultimoDia.estoque_top10_linhas || erp.vendas?.estoque_top10_linhas || [],
    estoque_grupos_top10: ultimoDia.estoque_grupos_top10 || ultimoCom('estoque') || null,
    financeiro: ultimoDia.financeiro || ultimoCom('financeiro') || null,
    contas_pagas: ultimoDia.contas_pagas || ultimoCom('contas_pagas') || null,
    contas_recebidas: ultimoDia.contas_recebidas || ultimoCom('contas_recebidas') || null,
    insights: ultimoDia.insights || ultimoCom('insights') || erp.insights || null,
    top_clientes: [],
    por_representante: []
  };
}

const vendasPeriodo = agregarVendas();
const estoque = vendasPeriodo?.estoque_grupos_top10 || erp.estoque || null;
const financeiro = vendasPeriodo?.financeiro || erp.financeiro || null;
const contasPagas = vendasPeriodo?.contas_pagas || erp.contas_pagas || null;
const contasRecebidas = vendasPeriodo?.contas_recebidas || erp.contas_recebidas || null;
const insights = vendasPeriodo?.insights || erp.insights || null;

if (modulo === 'resumo') {
  const s = vendasPeriodo?.summary || {};
  return [{ json: {
    success: true,
    atualizadoEm: erp.atualizadoEm || null,
    data: vendasPeriodo?.data || erp.data || null,
    dataExecucao: erp.dataExecucao || null,
    janelaColeta: erp.janelaColeta || 'D-1',
    periodo: vendasPeriodo?.periodo || null,
    receita_total: s.receita_total || 0,
    volume_vendas: s.volume_vendas || 0,
    ticket_medio: s.ticket_medio || 0,
    total_itens: s.total_itens || 0,
    total_skus: s.total_skus || 0,
    receita_pdv: s.receita_pdv || 0,
    receita_b2b: 0,
    skus_criticos: (estoque?.linhas || []).filter(x => Number(x.estoque || 0) <= Math.max(2, Number(x.vendido_hoje || 0))).length,
    skus_alerta: (estoque?.linhas || []).filter(x => Number(x.estoque || 0) <= Math.max(5, Number(x.vendido_hoje || 0) * 2)).length,
    total_pago: financeiro?.summary?.total_pagamentos_d1 || contasPagas?.summary?.total_pago || 0,
    total_recebido: 0,
    saldo_liquido: round((financeiro?.summary?.total_pagamentos_d1 || 0) - (financeiro?.summary?.total_aberto || 0)),
    financeiro_aberto: financeiro?.summary?.total_aberto || 0,
    financeiro_vencido: financeiro?.summary?.total_vencido || 0,
    resumo_executivo: insights?.resumo_executivo || null,
    qt_alertas: (insights?.alertas || []).length,
    qt_recomendacoes: (insights?.recomendacoes || []).length
  } }];
}

if (modulo === 'vendas') return [{ json: vendasPeriodo ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo.data || erp.data || null, dados: vendasPeriodo } : { success: false, error: 'Vendas ainda nao coletadas', atualizadoEm: erp.atualizadoEm || null } }];
if (modulo === 'estoque') return [{ json: estoque ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: estoque } : { success: false, error: 'Estoque dos produtos vendidos ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
if (modulo === 'financeiro') return [{ json: financeiro ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: financeiro } : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
if (modulo === 'contas-pagar') return [{ json: financeiro ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: { ...financeiro, summary: { total_pendente: financeiro.summary?.total_aberto || 0, total_vencido: financeiro.summary?.total_vencido || 0, total_pago: financeiro.summary?.total_pagamentos_d1 || 0 }, vencidos: financeiro.vencidas || [], vencendo_7d: financeiro.vencendo_7d || [], classificacao: financeiro.classificacao_cp_cr } } : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
if (modulo === 'contas-receber') {
  const withAliases = (items = []) => items.map(item => ({
    ...item,
    id: item.id_parcela || item.id_conta || item.id,
    cliente: item.cliente || item.pessoa || 'Pessoa nao informada',
    valor: item.valor ?? item.valor_aberto ?? item.valor_pago ?? 0
  }));
  const saldoOperacional = round((financeiro?.summary?.total_pagamentos_d1 || 0) - (financeiro?.summary?.total_aberto || 0));
  return [{ json: financeiro ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: { ...financeiro, summary: { total_pendente: financeiro.summary?.total_aberto || 0, total_inadimplente: financeiro.summary?.total_vencido || 0, total_recebendo_7d: financeiro.summary?.total_vencendo_7d || 0, saldo_liquido: saldoOperacional }, inadimplentes: withAliases(financeiro.vencidas || []), recebendo_7d: withAliases(financeiro.vencendo_7d || []), classificacao: financeiro.classificacao_cp_cr } } : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
}
if (modulo === 'fluxo-caixa') {
  const pago = financeiro?.summary?.total_pagamentos_d1 || 0;
  const aberto = financeiro?.summary?.total_aberto || 0;
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: { summary: { pagamentos_realizados: pago, aberto_previsto: aberto, saldo: round(pago - aberto) }, projecao_4_semanas: (financeiro?.fluxo_diario || []).slice(0, 28).map(x => ({ semana: x.data, entradas_previstas: x.total_aberto, saidas_previstas: 0, saldo_semana: x.total_aberto })) } } }];
}
if (modulo === 'insights') return [{ json: insights ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: { ...insights, summary: vendasPeriodo?.summary || {}, contexto: { receita_total: vendasPeriodo?.summary?.receita_total || 0, volume_vendas: vendasPeriodo?.summary?.volume_vendas || 0, total_skus: vendasPeriodo?.summary?.total_skus || 0, total_grupos: estoque?.summary?.total_grupos || 0, total_pago: financeiro?.summary?.total_pagamentos_d1 || 0, total_recebido: 0, total_aberto: financeiro?.summary?.total_aberto || 0, total_vencido: financeiro?.summary?.total_vencido || 0 } } } : { success: false, error: 'Insights ainda nao gerados pelo agente IA', atualizadoEm: erp.atualizadoEm || null } }];

return [{ json: { success: false, error: 'Modulo invalido: ' + modulo, modulos: ['resumo', 'vendas', 'estoque', 'financeiro', 'contas-pagar', 'contas-receber', 'fluxo-caixa', 'insights'] } }];
`;

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

function upsertNode(wf, name, builder) {
  let node = wf.nodes.find((n) => n.name === name);
  if (!node) {
    node = builder();
    wf.nodes.push(node);
  } else {
    Object.assign(node, builder(node));
  }
  return node;
}

async function main() {
  await request('POST', `/workflows/${WF_ID}/deactivate`);
  const { status, body: wf } = await request('GET', `/workflows/${WF_ID}`);
  if (status !== 200) throw new Error(`GET workflow failed: ${status}`);

  upsertNode(wf, 'Coletar Financeiro Dapic', (prev) => ({
    id: prev?.id || 'coletar-financeiro-dapic',
    name: 'Coletar Financeiro Dapic',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1584, 0],
    parameters: { jsCode: COLETAR_FINANCEIRO_DAPIC_CODE },
  }));

  const prompt = wf.nodes.find((n) => n.name === 'Preparar Prompt IA');
  const parse = wf.nodes.find((n) => n.name === 'Parse Insights');
  const save = wf.nodes.find((n) => n.name === 'Salvar Relatorio');
  const api = wf.nodes.find((n) => n.name === 'Ler Dados ERP');
  const agent = wf.nodes.find((n) => n.name === 'Agente IA');
  const model = wf.nodes.find((n) => n.name === 'OpenAI Chat (gpt-4o)');

  if (!prompt || !parse || !save || !api || !agent || !model) {
    throw new Error('Required AI/API nodes were not found');
  }

  wf.nodes = wf.nodes.filter((n) => !['Coletar Contas Pagas', 'Coletar Contas Recebidas'].includes(n.name));
  delete wf.connections['Coletar Contas Pagas'];
  delete wf.connections['Coletar Contas Recebidas'];

  prompt.position = [1808, 0];
  prompt.parameters.jsCode = PREPARAR_PROMPT_IA_CODE;
  agent.position = [2256, 0];
  agent.parameters.promptType = 'define';
  agent.parameters.text = '={{ $json.prompt_agente || $json.chatInput }}';
  agent.parameters.options = agent.parameters.options || {};
  agent.parameters.options.systemMessage = '={{ $json.system_message || "Voce e um assistente especialista em analise financeira, PCP e apoio a decisao para a Tech Malhas. Responda em portugues do Brasil, de forma objetiva e pratica." }}';
  model.position = [2256, 256];
  model.parameters.options = model.parameters.options || {};
  delete model.parameters.options.responseFormat;
  parse.position = [2480, 0];
  parse.parameters.jsCode = PARSE_INSIGHTS_CODE;
  save.position = [2704, 0];
  save.parameters.jsCode = SALVAR_RELATORIO_CODE;
  api.parameters.jsCode = API_READ_CODE;

  wf.connections['Coletar Estoque Grupos Top 10'] = { main: [[{ node: 'Coletar Financeiro Dapic', type: 'main', index: 0 }]] };
  wf.connections['Coletar Financeiro Dapic'] = { main: [[{ node: 'Preparar Prompt IA', type: 'main', index: 0 }]] };
  wf.connections['Preparar Prompt IA'] = { main: [[{ node: 'Agente IA', type: 'main', index: 0 }]] };
  wf.connections['Agente IA'] = { main: [[{ node: 'Parse Insights', type: 'main', index: 0 }]] };
  wf.connections['Parse Insights'] = { main: [[{ node: 'Salvar Relatorio', type: 'main', index: 0 }]] };
  wf.connections['OpenAI Chat (gpt-4o)'] = { ai_languageModel: [[{ node: 'Agente IA', type: 'ai_languageModel', index: 0 }]] };

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const key of allowed) if (wf.settings?.[key] !== undefined) settings[key] = wf.settings[key];

  const put = await request('PUT', `/workflows/${WF_ID}`, { name: wf.name, nodes: wf.nodes, connections: wf.connections, settings });
  if (put.status >= 400) throw new Error(`PUT failed ${put.status}: ${JSON.stringify(put.body).slice(0, 800)}`);
  const activate = await request('POST', `/workflows/${WF_ID}/activate`);
  if (activate.status >= 400) throw new Error(`Activate failed ${activate.status}: ${JSON.stringify(activate.body).slice(0, 800)}`);

  console.log(JSON.stringify({
    ok: true,
    workflowId: WF_ID,
    nodes: wf.nodes.length,
    flow: [
      'Cron/Webhook',
      'Definir Periodo D-1',
      'Autenticar Dapic',
      'Vendas PDV',
      'Estoque produtos vendidos',
      'Financeiro Dapic generico',
      'Agente IA',
      'Salvar Static Data',
      'API /webhook/erp',
    ],
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
