/**
 * Implementa logica D-1 (cron 06h) + D0 (webhook Atualizar) com acumulado no dashboard.
 *
 * - Preparar Contexto: detecta fonte e define janela D-1 ou D0
 * - Salvar Relatorio: snapshot_d1 | snapshot_d0; cron limpa snapshot_d0
 * - Ler Dados ERP: combina snapshots para API (resumo, vendas, estoque, insights)
 * - Preparar Prompt IA: prompt diferente para cron vs webhook + contexto D-1 no ao vivo
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
          try {
            resolve({ status: res.statusCode, body: JSON.parse(raw) });
          } catch {
            resolve({ status: res.statusCode, body: raw });
          }
        });
      }
    );
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

const PREPARAR_CONTEXTO_CODE = `
const auth = $('🔐 Autenticar Dapic').first().json;
const token = auth.access_token || auth.token || (auth.data && auth.data.access_token) || '';
if (!token) {
  throw new Error('Falha na autenticacao Dapic: access_token nao retornado. Resposta: ' + JSON.stringify(auth).slice(0, 300));
}

const TZ = 'America/Sao_Paulo';
const fmt = (d) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(d);

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

const agora = new Date();
const dataHoje = fmt(agora);
const ontem = new Date(agora.getTime() - 24 * 60 * 60 * 1000);
const dataOntem = fmt(ontem);

const isD0 = fonte === 'webhook' || fonte === 'manual';
const janelaColeta = isD0 ? 'D0' : 'D-1';
const dataColeta = isD0 ? dataHoje : dataOntem;

return [{
  json: {
    token,
    dataHoje,
    dataColeta,
    dataOntem,
    janelaColeta,
    fonteColeta: fonte,
    baseUrl: 'https://api.dapic.com.br',
    iniciadoEm: agora.toISOString()
  }
}];
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
const janela = ctx.janelaColeta || 'D-1';

let fonte = ctx.fonteColeta || 'manual';
try {
  $('Cron Diario 06:00').first();
  fonte = 'cron';
} catch (eCron) {
  try {
    $('Webhook Manual').first();
    fonte = 'webhook';
  } catch (eWh) {
    fonte = ctx.fonteColeta || 'manual';
  }
}

const agora = new Date().toISOString();
const snap = {
  vendas: dados,
  estoque: dados.estoque_grupos_top10 || null,
  financeiro: dados.financeiro || null,
  insights: dados.insights || null,
  data: dataColeta,
  janela,
  atualizadoEm: agora,
  fonte
};

if (fonte === 'cron') {
  staticData.erp.snapshot_d1 = snap;
  staticData.erp.snapshot_d0 = null;
  staticData.erp.lastCronRun = agora;
} else {
  staticData.erp.snapshot_d0 = snap;
  staticData.erp.lastManualRun = agora;
}

staticData.erp.vendas = dados;
staticData.erp.estoque = dados.estoque_grupos_top10 || null;
staticData.erp.financeiro = dados.financeiro || null;
staticData.erp.insights = dados.insights || null;
staticData.erp.data = dataColeta;
staticData.erp.dataExecucao = ctx.dataHoje;
staticData.erp.janelaColeta = janela;
staticData.erp.atualizadoEm = agora;
staticData.erp.fonteUltimaColeta = fonte;

if (!staticData.erp.historico.diario[dataColeta]) staticData.erp.historico.diario[dataColeta] = { data: dataColeta };
staticData.erp.historico.diario[dataColeta].vendas = dados;
staticData.erp.historico.diario[dataColeta].estoque = dados.estoque_grupos_top10 || null;
staticData.erp.historico.diario[dataColeta].financeiro = dados.financeiro || null;
staticData.erp.historico.diario[dataColeta].insights = dados.insights || null;
staticData.erp.historico.diario[dataColeta].atualizadoEm = agora;
staticData.erp.historico.diario[dataColeta].fonteUltimaColeta = fonte;
staticData.erp.historico.diario[dataColeta].janela = janela;

const datas = Object.keys(staticData.erp.historico.diario).sort();
while (datas.length > 120) {
  delete staticData.erp.historico.diario[datas.shift()];
}

return [{ json: {
  sucesso: true,
  data: dataColeta,
  janelaColeta: janela,
  fonteUltimaColeta: fonte,
  atualizadoEm: agora,
  lastCronRun: staticData.erp.lastCronRun || null,
  lastManualRun: staticData.erp.lastManualRun || null,
  tem_snapshot_d1: Boolean(staticData.erp.snapshot_d1),
  tem_snapshot_d0: Boolean(staticData.erp.snapshot_d0),
  resumo: dados.summary
} }];
`;

const LER_DADOS_ERP_CODE = `
const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const query = $input.first().json.query || {};
const modulo = String(query.modulo || 'resumo').toLowerCase();
const dias = Math.max(1, Math.min(Number(query.dias || 1), 120));
const diario = erp.historico?.diario || {};
const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

const snapD1 = erp.snapshot_d1?.vendas || null;
const snapD0 = erp.snapshot_d0?.vendas || null;

function mergeProdutos(lista) {
  const map = new Map();
  for (const p of lista) {
    const chave = (p.codigo || 'SEM') + '|' + (p.produto || 'N/A');
    const cur = map.get(chave) || {
      codigo: p.codigo,
      produto: p.produto,
      id_produto: p.id_produto || null,
      quantidade: 0,
      valor_total: 0,
      valor_unitario_medio: 0
    };
    cur.quantidade += Number(p.quantidade || 0);
    cur.valor_total += Number(p.valor_total || 0);
    if (p.valor_unitario_medio) cur.valor_unitario_medio = p.valor_unitario_medio;
    map.set(chave, cur);
  }
  return Array.from(map.values())
    .map(p => ({
      codigo: p.codigo,
      produto: p.produto,
      id_produto: p.id_produto,
      quantidade: round(p.quantidade),
      valor_unitario_medio: round(p.valor_unitario_medio || (p.quantidade > 0 ? p.valor_total / p.quantidade : 0)),
      valor_total: round(p.valor_total)
    }))
    .sort((a, b) => b.quantidade - a.quantidade);
}

function combineFinanceiro(f1, f0) {
  const fin = f0 || f1;
  if (!f1) return f0;
  if (!f0) return f1;
  const s1 = f1.summary || {};
  const s0 = f0.summary || {};
  return {
    ...f0,
    data: f0.data || f1.data,
    summary: {
      total_pago_d1: round(Number(s1.total_pago_d1 || 0) + Number(s0.total_pago_d1 || 0)),
      total_pagamentos_d1: round(Number(s1.total_pagamentos_d1 || 0) + Number(s0.total_pagamentos_d1 || 0)),
      qtd_pagas_d1: Number(s1.qtd_pagas_d1 || 0) + Number(s0.qtd_pagas_d1 || 0),
      qtd_pagamentos_d1: Number(s1.qtd_pagamentos_d1 || 0) + Number(s0.qtd_pagamentos_d1 || 0),
      total_aberto: round(Number(s0.total_aberto ?? s1.total_aberto ?? 0)),
      qtd_abertas: Number(s0.qtd_abertas ?? s1.qtd_abertas ?? 0),
      total_aberto_d1: round(Number(s1.total_aberto_d1 || 0) + Number(s0.total_aberto_d1 || 0)),
      total_vencido: round(Number(s0.total_vencido ?? s1.total_vencido ?? 0)),
      total_vencendo_7d: round(Number(s0.total_vencendo_7d ?? s1.total_vencendo_7d ?? 0))
    },
    observacao: f0.observacao || f1.observacao
  };
}

function buildAcumulado() {
  if (!snapD1 && !snapD0) return null;
  const v1 = snapD1;
  const v0 = snapD0;
  if (!v1) {
    return {
      ...v0,
      janela: 'D0',
      acumulado_breakdown: {
        ontem: null,
        hoje: { data: v0.data, summary: v0.summary || {}, atualizadoEm: erp.snapshot_d0?.atualizadoEm || null }
      }
    };
  }
  if (!v0) {
    return {
      ...v1,
      janela: 'D-1',
      acumulado_breakdown: {
        ontem: { data: v1.data, summary: v1.summary || {}, atualizadoEm: erp.snapshot_d1?.atualizadoEm || null },
        hoje: null
      }
    };
  }
  const s1 = v1.summary || {};
  const s0 = v0.summary || {};
  const receita = Number(s1.receita_total || 0) + Number(s0.receita_total || 0);
  const volume = Number(s1.volume_vendas || 0) + Number(s0.volume_vendas || 0);
  const itens = Number(s1.total_itens || 0) + Number(s0.total_itens || 0);
  const produtos = mergeProdutos([...(v1.produtos_vendidos || []), ...(v0.produtos_vendidos || [])]);
  return {
    gerado_em: erp.atualizadoEm || new Date().toISOString(),
    janela: 'D-1+D0',
    data: v0.data || erp.dataExecucao,
    periodo: { inicio: v1.data, fim: v0.data, tipo: 'acumulado', dias: 2 },
    summary: {
      receita_total: round(receita),
      volume_vendas: volume,
      ticket_medio: volume > 0 ? round(receita / volume) : 0,
      total_itens: round(itens),
      total_skus: produtos.length,
      receita_pdv: round(receita),
      receita_b2b: 0
    },
    evolucao_diaria: [...(v1.evolucao_diaria || []), ...(v0.evolucao_diaria || [])],
    produtos_vendidos: produtos,
    top_produtos: produtos.slice(0, 10),
    estoque_top10: v0.estoque_top10 || v1.estoque_top10 || [],
    estoque_top10_linhas: v0.estoque_top10_linhas || v1.estoque_top10_linhas || [],
    estoque_grupos_top10: v0.estoque_grupos_top10 || erp.snapshot_d0?.estoque || erp.snapshot_d1?.estoque || null,
    financeiro: combineFinanceiro(v1.financeiro, v0.financeiro),
    insights: erp.snapshot_d0?.insights || erp.snapshot_d1?.insights || erp.insights || null,
    acumulado_breakdown: {
      ontem: { data: v1.data, summary: s1, atualizadoEm: erp.snapshot_d1?.atualizadoEm || null },
      hoje: { data: v0.data, summary: s0, atualizadoEm: erp.snapshot_d0?.atualizadoEm || null }
    }
  };
}

function ultimoCom(campo) {
  const datas = Object.keys(diario).sort();
  for (let i = datas.length - 1; i >= 0; i--) {
    const d = diario[datas[i]];
    if (d && d[campo]) return d[campo];
  }
  return erp[campo] || null;
}

function agregarVendasHistorico() {
  const datasComVendas = Object.keys(diario).filter(d => diario[d]?.vendas?.summary).sort();
  const datasOrdenadas = datasComVendas.length ? datasComVendas : Object.keys(diario).sort();
  const datasPeriodo = datasOrdenadas.slice(-dias);
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
    codigo: p.codigo, produto: p.produto, id_produto: p.id_produto,
    quantidade: round(p.quantidade), valor_unitario_medio: round(p.valor_unitario_medio), valor_total: round(p.valor_total)
  })).sort((a, b) => b.quantidade - a.quantidade);
  const ultimoDia = diasComVendas[diasComVendas.length - 1]?.vendas || {};
  return {
    gerado_em: erp.atualizadoEm || new Date().toISOString(),
    janela: erp.janelaColeta || 'historico',
    data: ultimoDia.data || erp.data,
    periodo: { inicio: datasPeriodo[0] || erp.data, fim: datasPeriodo[datasPeriodo.length - 1] || erp.data, dias },
    summary: {
      receita_total: round(receitaTotal), volume_vendas: volumeTotal,
      ticket_medio: volumeTotal > 0 ? round(receitaTotal / volumeTotal) : 0,
      total_itens: round(itensTotais), total_skus: produtos.length,
      receita_pdv: round(receitaTotal), receita_b2b: 0
    },
    evolucao_diaria: evolucao, produtos_vendidos: produtos, top_produtos: produtos.slice(0, 10),
    estoque_top10: ultimoDia.estoque_top10 || erp.vendas?.estoque_top10 || [],
    estoque_top10_linhas: ultimoDia.estoque_top10_linhas || erp.vendas?.estoque_top10_linhas || [],
    estoque_grupos_top10: ultimoDia.estoque_grupos_top10 || ultimoCom('estoque') || null,
    financeiro: ultimoDia.financeiro || ultimoCom('financeiro') || null,
    insights: ultimoDia.insights || ultimoCom('insights') || erp.insights || null
  };
}

const acumulado = buildAcumulado();
const vendasPeriodo = (dias <= 2 && acumulado) ? acumulado : (acumulado && dias === 1 ? acumulado : agregarVendasHistorico());
const estoque = vendasPeriodo?.estoque_grupos_top10 || erp.snapshot_d0?.estoque || erp.estoque || null;
const financeiro = vendasPeriodo?.financeiro || erp.financeiro || null;
const insights = vendasPeriodo?.insights || erp.insights || null;
const breakdown = vendasPeriodo?.acumulado_breakdown || null;

if (modulo === 'resumo') {
  const s = vendasPeriodo?.summary || {};
  return [{ json: {
    success: true,
    atualizadoEm: erp.atualizadoEm || null,
    data: vendasPeriodo?.data || erp.data || null,
    dataExecucao: erp.dataExecucao || null,
    janelaColeta: vendasPeriodo?.janela || erp.janelaColeta || 'D-1',
    periodo: vendasPeriodo?.periodo || null,
    acumulado_breakdown: breakdown,
    tem_snapshot_d1: Boolean(erp.snapshot_d1),
    tem_snapshot_d0: Boolean(erp.snapshot_d0),
    receita_total: s.receita_total || 0,
    volume_vendas: s.volume_vendas || 0,
    ticket_medio: s.ticket_medio || 0,
    total_itens: s.total_itens || 0,
    total_skus: s.total_skus || 0,
    receita_pdv: s.receita_pdv || 0,
    receita_b2b: 0,
    skus_criticos: (estoque?.linhas || []).filter(x => Number(x.estoque || 0) <= Math.max(2, Number(x.vendido_hoje || 0))).length,
    skus_alerta: (estoque?.linhas || []).filter(x => Number(x.estoque || 0) <= Math.max(5, Number(x.vendido_hoje || 0) * 2)).length,
    total_pago: financeiro?.summary?.total_pagamentos_d1 || 0,
    total_recebido: 0,
    saldo_liquido: round((financeiro?.summary?.total_pagamentos_d1 || 0) - (financeiro?.summary?.total_aberto || 0)),
    financeiro_aberto: financeiro?.summary?.total_aberto || 0,
    financeiro_vencido: financeiro?.summary?.total_vencido || 0,
    resumo_executivo: insights?.resumo_executivo || null,
    qt_alertas: (insights?.alertas || []).length,
    qt_recomendacoes: (insights?.recomendacoes || []).length,
    ultimaColetaCron: erp.lastCronRun || null,
    ultimaColetaManual: erp.lastManualRun || null,
    fonteUltimaColeta: erp.fonteUltimaColeta || null
  } }];
}

if (modulo === 'vendas') {
  return [{ json: vendasPeriodo
    ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo.data || erp.data, dados: vendasPeriodo }
    : { success: false, error: 'Vendas ainda nao coletadas', atualizadoEm: erp.atualizadoEm || null }
  }];
}
if (modulo === 'estoque') {
  return [{ json: estoque
    ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: estoque }
    : { success: false, error: 'Estoque ainda nao coletado', atualizadoEm: erp.atualizadoEm || null }
  }];
}
if (modulo === 'financeiro') {
  return [{ json: financeiro
    ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: financeiro }
    : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null }
  }];
}
if (modulo === 'contas-pagar') {
  return [{ json: financeiro ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: { ...financeiro, summary: { total_pendente: financeiro.summary?.total_aberto || 0, total_vencido: financeiro.summary?.total_vencido || 0, total_pago: financeiro.summary?.total_pagamentos_d1 || 0 }, vencidos: financeiro.vencidas || [], vencendo_7d: financeiro.vencendo_7d || [] } } : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
}
if (modulo === 'contas-receber') {
  const saldoOperacional = round((financeiro?.summary?.total_pagamentos_d1 || 0) - (financeiro?.summary?.total_aberto || 0));
  return [{ json: financeiro ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: { ...financeiro, summary: { total_pendente: financeiro.summary?.total_aberto || 0, total_inadimplente: financeiro.summary?.total_vencido || 0, total_recebendo_7d: financeiro.summary?.total_vencendo_7d || 0, saldo_liquido: saldoOperacional }, inadimplentes: financeiro.vencidas || [], recebendo_7d: financeiro.vencendo_7d || [] } } : { success: false, error: 'Financeiro ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
}
if (modulo === 'fluxo-caixa') {
  const pago = financeiro?.summary?.total_pagamentos_d1 || 0;
  const aberto = financeiro?.summary?.total_aberto || 0;
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: { summary: { pagamentos_realizados: pago, aberto_previsto: aberto, saldo: round(pago - aberto) }, projecao_4_semanas: (financeiro?.fluxo_diario || []).slice(0, 28).map(x => ({ semana: x.data, entradas_previstas: x.total_aberto, saidas_previstas: 0, saldo_semana: x.total_aberto })) } } }];
}
if (modulo === 'insights') {
  return [{ json: insights ? { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data, dados: { ...insights, summary: vendasPeriodo?.summary || {}, acumulado_breakdown: breakdown, contexto: { receita_total: vendasPeriodo?.summary?.receita_total || 0, volume_vendas: vendasPeriodo?.summary?.volume_vendas || 0, janela: vendasPeriodo?.janela } } } : { success: false, error: 'Insights ainda nao gerados', atualizadoEm: erp.atualizadoEm || null } }];
}

return [{ json: { success: false, error: 'Modulo invalido: ' + modulo, modulos: ['resumo', 'vendas', 'estoque', 'financeiro', 'contas-pagar', 'contas-receber', 'fluxo-caixa', 'insights'] } }];
`;

const PREPARAR_PROMPT_IA_CODE = `
const item = $input.first().json;
const dados = item.dados || {};
const financeiro = dados.financeiro || {};
const ctx = $('Preparar Contexto').first().json;
const janela = ctx.janelaColeta || dados.janela || 'D-1';
const isAoVivo = janela === 'D0';

const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const snapOntem = erp.snapshot_d1?.vendas || null;

const top = (dados.top_produtos || []).slice(0, 10).map(p => ({
  codigo: p.codigo, produto: p.produto, quantidade: p.quantidade, valor_total: p.valor_total
}));

const grupos = ((dados.estoque_grupos_top10 || {}).grupos || []).slice(0, 8).map(g => ({
  grupo: g.grupo, total_produtos: g.total_produtos, total_vendido_hoje: g.total_vendido_hoje,
  total_estoque: g.total_estoque,
  produtos: (g.produtos || []).slice(0, 8).map(p => ({
    codigo: p.codigo, produto: p.produto, vendido_hoje: p.vendido_hoje,
    estoque_total: p.estoque_total,
    variacoes_baixas: (p.variacoes || []).filter(v => Number(v.estoque) <= Math.max(5, Number(v.vendido_hoje || 0) * 2)).slice(0, 6)
  }))
}));

const payload = {
  data_referencia: dados.data || dados.periodo?.fim,
  janela,
  vendas_summary: dados.summary || {},
  top_produtos: top,
  estoque_summary: (dados.estoque_grupos_top10 || {}).summary || {},
  grupos_top10: grupos,
  financeiro: { summary: financeiro.summary || {} },
  contexto_ontem: snapOntem ? {
    data: snapOntem.data,
    summary: snapOntem.summary || {},
    top_produtos: (snapOntem.top_produtos || []).slice(0, 5)
  } : null
};

const systemCron = [
  'Voce e um agente executivo de varejo de moda da Tech Malhas em Franca/SP.',
  'Analise o FECHAMENTO D-1 (dia anterior completo) do ERP Dapic.',
  'Use SOMENTE os numeros do JSON. Nao invente dados.',
  'Responda somente em JSON valido, sem markdown.',
  'Schema: { "resumo_executivo": "...", "destaques": [...], "alertas": [...], "recomendacoes": [...] }',
  'Gere 3-5 destaques, 3-8 alertas, 3-6 recomendacoes.'
].join('\\n');

const systemAoVivo = [
  'Voce e um agente executivo de varejo de moda da Tech Malhas em Franca/SP.',
  'Analise as vendas AO VIVO de HOJE (D0) do ERP Dapic.',
  'Compare com contexto_ontem quando disponivel (fechamento de ontem).',
  'Destaque ritmo do dia, produtos em alta agora, estoque em risco para o restante do dia.',
  'Use SOMENTE os numeros do JSON. Nao invente dados.',
  'Responda somente em JSON valido, sem markdown.',
  'Schema: { "resumo_executivo": "...", "destaques": [...], "alertas": [...], "recomendacoes": [...] }',
  'Gere 3-5 destaques, 3-8 alertas, 3-6 recomendacoes.'
].join('\\n');

const system = isAoVivo ? systemAoVivo : systemCron;
const intro = isAoVivo
  ? 'Analise este snapshot AO VIVO (hoje) do ERP e compare com ontem quando houver contexto_ontem:'
  : 'Analise este snapshot D-1 (fechamento de ontem) do ERP Dapic:';

const prompt_agente = intro + '\\n' + JSON.stringify(payload);

return [{ json: {
  modulo: 'insights',
  dados,
  prompt_agente,
  system_message: system,
  payload_ia: payload,
  chatInput: prompt_agente
} }];
`;

(async () => {
  const wfRes = await request('GET', `/workflows/${WF_ID}`);
  if (wfRes.status !== 200) throw new Error('GET workflow falhou: ' + wfRes.status);
  const wf = wfRes.body;

  const prep = wf.nodes.find((n) => n.name.includes('Preparar Contexto'));
  const salvar = wf.nodes.find((n) => n.name.includes('Salvar Relatorio'));
  const ler = wf.nodes.find((n) => n.name.includes('Ler Dados ERP'));
  const prompt = wf.nodes.find((n) => n.name.includes('Preparar Prompt IA'));
  if (!prep || !salvar || !ler || !prompt) throw new Error('Nodes obrigatorios nao encontrados');

  prep.parameters.jsCode = PREPARAR_CONTEXTO_CODE;
  salvar.parameters.jsCode = SALVAR_RELATORIO_CODE;
  ler.parameters.jsCode = LER_DADOS_ERP_CODE;
  prompt.parameters.jsCode = PREPARAR_PROMPT_IA_CODE;

  console.log('OK — Preparar Contexto (D-1 cron / D0 webhook)');
  console.log('OK — Salvar Relatorio (snapshot_d1 + snapshot_d0)');
  console.log('OK — Ler Dados ERP (acumulado D-1+D0)');
  console.log('OK — Preparar Prompt IA (cron vs ao vivo)');

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const k of allowed) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];

  const put = await request('PUT', `/workflows/${WF_ID}`, {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections,
    settings,
  });
  if (put.status >= 400) {
    console.error('PUT falhou:', put.status, JSON.stringify(put.body).slice(0, 800));
    process.exit(1);
  }
  console.log('OK — workflow salvo no n8n');
})().catch((e) => {
  console.error('ERR', e.message || e);
  process.exit(1);
});
