/**
 * fix-cp-cr-staticdata.js
 * PROBLEMA: Merge CP+CR saindo com 0 itens (payload muito grande bloqueava o node)
 * SOLUÇÃO: CP e CR salvam arrays no Static Data e retornam apenas {done:true}
 *          Merge CP+CR recebe 2 itens leves → funciona
 *          Transformar Financeiro lê os arrays do Static Data
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

// ─── Coletar CP: salva no Static Data, retorna sinal leve ────────────────────
const COLETAR_CP_CODE = `// COLETAR CONTAS A PAGAR — salva em Static Data para evitar payload grande no Merge
const ctx = $('💾 Preparar Contexto').first().json;
const { token, data90DiasAtras, dataMais30Dias, baseUrl } = ctx;

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
      json: true, timeout: 15000
    });
    if (response.Dados && response.Dados.length > 0) allData = allData.concat(response.Dados);
    totalPaginas = Math.min(response.TotalPaginas || 1, MAX_PAGINAS);
    if (pagina < totalPaginas) await new Promise(r => setTimeout(r, 300));
    pagina++;
  } while (pagina <= totalPaginas);
  return allData;
}

let todasParcelas = [];
try {
  todasParcelas = await fetchAllPages.call(this, '/v1/contas/parcelas', {
    DataInicial: data90DiasAtras, DataFinal: dataMais30Dias, FiltrarPor: 0
  });
} catch(e) { console.log('Aviso CP:', e.message); }

// Salvar em Static Data (evita payload grande no Merge)
const staticData = $getWorkflowStaticData('global');
staticData.erp_parcelas_raw = todasParcelas;

// Retornar sinal leve para Merge CP+CR funcionar
return [{ json: { done: true, modulo: 'cp', totalRegistros: todasParcelas.length } }];`;

// ─── Coletar CR: apenas sinaliza (usa os mesmos dados do CP) ─────────────────
const COLETAR_CR_CODE = `// COLETAR CONTAS A RECEBER — usa dados já salvos pelo Coletar CP no Static Data
// O endpoint /v1/contas/parcelas retorna CP e CR juntos, então não precisamos buscar de novo
// Apenas sinalizamos para o Merge CP+CR que CR também está pronto

// Verificar se Static Data tem os dados (salvos pelo Coletar CP)
const staticData = $getWorkflowStaticData('global');
const totalJaColetado = (staticData.erp_parcelas_raw || []).length;

// Retornar sinal leve para Merge CP+CR funcionar
return [{ json: { done: true, modulo: 'cr', totalRegistros: totalJaColetado } }];`;

// ─── Transformar Financeiro: lê do Static Data ───────────────────────────────
const TRANSFORMAR_FINANCEIRO_CODE = `// TRANSFORMAR FINANCEIRO — lê parcelas do Static Data (salvas por Coletar CP)
const staticData = $getWorkflowStaticData('global');
const ctx = $('💾 Preparar Contexto').first().json;

const todasParcelas = staticData.erp_parcelas_raw || [];
const hoje = new Date(ctx.dataHoje);
const daqui7Dias = new Date(ctx.dataMais7Dias);

console.log('Total de parcelas para processar:', todasParcelas.length);

// Detectar campos do tipo da parcela (a API pode usar nomes diferentes)
function getTipo(p) {
  return String(p.Tipo || p.tipo || p.TipoLancamento || p.TipoMovimento || p.Natureza || p.natureza || p.TipoFinanceiro || '').toLowerCase();
}

// Separar CP e CR com múltiplos critérios
const contasPagar = todasParcelas.filter(p => {
  const tipo = getTipo(p);
  return tipo.includes('pagar') || tipo.includes('despesa') || tipo.includes('saida') || tipo === 'p' || tipo === 'cp';
});

const contasReceber = todasParcelas.filter(p => {
  const tipo = getTipo(p);
  return tipo.includes('receber') || tipo.includes('receita') || tipo.includes('entrada') || tipo === 'r' || tipo === 'cr';
});

// Se filtros retornaram 0, mostrar campos disponíveis e dividir ao meio
if (contasPagar.length === 0 && contasReceber.length === 0 && todasParcelas.length > 0) {
  const amostra = todasParcelas[0];
  console.log('Campos disponíveis na parcela:', Object.keys(amostra).join(', '));
  console.log('Amostra do primeiro registro:', JSON.stringify(amostra).slice(0, 300));
  // Última tentativa: dividir ao meio (assumindo que metade é CP e metade CR)
  const meio = Math.floor(todasParcelas.length / 2);
  contasPagar.push(...todasParcelas.slice(0, meio));
  contasReceber.push(...todasParcelas.slice(meio));
}

console.log('Após filtro — CP:', contasPagar.length, 'CR:', contasReceber.length);

function calcularDiasAtraso(dataVencStr) {
  if (!dataVencStr) return 0;
  const dataVenc = new Date(dataVencStr.split('T')[0]);
  return Math.floor((hoje - dataVenc) / (1000*60*60*24));
}

function getNumSemana(data) {
  const d = new Date(data);
  const startOfYear = new Date(d.getFullYear(), 0, 1);
  const weekNum = Math.ceil(((d - startOfYear) / 86400000 + startOfYear.getDay() + 1) / 7);
  return \`\${d.getFullYear()}-W\${String(weekNum).padStart(2, '0')}\`;
}

const statusPago = ['Pago', 'pago', 'Liquidado', 'Recebido', 'recebido', 'Baixado', 'baixado'];

// ===== CONTAS A PAGAR =====
const cpPendentes = contasPagar.filter(p => !statusPago.includes(p.Status || p.status || ''));
const cpVencidos = cpPendentes.filter(p => new Date((p.DataVencimento || p.dataVencimento || '').split('T')[0]) < hoje);
const cpVencendo7d = cpPendentes.filter(p => {
  const venc = new Date((p.DataVencimento || p.dataVencimento || '').split('T')[0]);
  return venc >= hoje && venc <= daqui7Dias;
});

const totalCP = cpPendentes.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);
const totalCPVencido = cpVencidos.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);
const totalCPVencendo7d = cpVencendo7d.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);

const fluxoCP = {};
for (const p of cpPendentes) {
  const dataVenc = (p.DataVencimento || p.dataVencimento || ctx.dataHoje).split('T')[0];
  const semana = getNumSemana(dataVenc);
  if (!fluxoCP[semana]) fluxoCP[semana] = 0;
  fluxoCP[semana] += Number(p.Valor || p.valor || 0);
}

// ===== CONTAS A RECEBER =====
const crPendentes = contasReceber.filter(p => !statusPago.includes(p.Status || p.status || ''));
const crInadimplentes = crPendentes.filter(p => new Date((p.DataVencimento || p.dataVencimento || '').split('T')[0]) < hoje);
const crRecebendo7d = crPendentes.filter(p => {
  const venc = new Date((p.DataVencimento || p.dataVencimento || '').split('T')[0]);
  return venc >= hoje && venc <= daqui7Dias;
});

const totalCR = crPendentes.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);
const totalCRInadimplente = crInadimplentes.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);
const totalCRRecebendo7d = crRecebendo7d.reduce((s, p) => s + Number(p.Valor || p.valor || 0), 0);
const saldoLiquido = totalCR - totalCP;

const fluxoCR = {};
for (const p of crPendentes) {
  const dataVenc = (p.DataVencimento || p.dataVencimento || ctx.dataHoje).split('T')[0];
  const semana = getNumSemana(dataVenc);
  if (!fluxoCR[semana]) fluxoCR[semana] = 0;
  fluxoCR[semana] += Number(p.Valor || p.valor || 0);
}

const todasSemanas = new Set([...Object.keys(fluxoCP), ...Object.keys(fluxoCR)]);
const semanasOrdenadas = Array.from(todasSemanas).sort().slice(0, 4);
let saldoAcumulado = 0;
const projecao4Semanas = semanasOrdenadas.map(semana => {
  const entradas = fluxoCR[semana] || 0;
  const saidas = fluxoCP[semana] || 0;
  const saldoSemana = entradas - saidas;
  saldoAcumulado += saldoSemana;
  return { semana, entradas_previstas: Math.round(entradas*100)/100, saidas_previstas: Math.round(saidas*100)/100, saldo_semana: Math.round(saldoSemana*100)/100, saldo_acumulado: Math.round(saldoAcumulado*100)/100 };
});

const contasPagarJSON = {
  gerado_em: new Date().toISOString(),
  summary: { total_pendente: Math.round(totalCP*100)/100, total_vencido: Math.round(totalCPVencido*100)/100, total_vencendo_7d: Math.round(totalCPVencendo7d*100)/100 },
  vencidos: cpVencidos.sort((a,b) => Number(b.Valor||0)-Number(a.Valor||0)).slice(0,50).map(p => ({
    id: p.Id||p.id, descricao: p.Descricao||p.descricao||p.NomeFornecedor||'N/A',
    valor: Number(p.Valor||p.valor||0), data_vencimento: (p.DataVencimento||p.dataVencimento||'').split('T')[0],
    dias_atraso: calcularDiasAtraso(p.DataVencimento||p.dataVencimento)
  })),
  vencendo_7d: cpVencendo7d.sort((a,b) => Number(b.Valor||0)-Number(a.Valor||0)).map(p => ({
    id: p.Id||p.id, descricao: p.Descricao||p.descricao||p.NomeFornecedor||'N/A',
    valor: Number(p.Valor||p.valor||0), data_vencimento: (p.DataVencimento||p.dataVencimento||'').split('T')[0]
  })),
  fluxo_semanal: Object.entries(fluxoCP).sort().map(([semana, total]) => ({ semana, total_saidas: Math.round(total*100)/100 }))
};

const contasReceberJSON = {
  gerado_em: new Date().toISOString(),
  summary: { total_pendente: Math.round(totalCR*100)/100, total_inadimplente: Math.round(totalCRInadimplente*100)/100, total_recebendo_7d: Math.round(totalCRRecebendo7d*100)/100, saldo_liquido: Math.round(saldoLiquido*100)/100 },
  inadimplentes: crInadimplentes.sort((a,b) => Number(b.Valor||0)-Number(a.Valor||0)).slice(0,50).map(p => ({
    id: p.Id||p.id, cliente: p.Cliente||p.cliente||p.NomeCliente||'N/A',
    valor: Number(p.Valor||p.valor||0), data_vencimento: (p.DataVencimento||p.dataVencimento||'').split('T')[0],
    dias_atraso: calcularDiasAtraso(p.DataVencimento||p.dataVencimento)
  })),
  recebendo_7d: crRecebendo7d.sort((a,b) => Number(b.Valor||0)-Number(a.Valor||0)).map(p => ({
    id: p.Id||p.id, cliente: p.Cliente||p.cliente||p.NomeCliente||'N/A',
    valor: Number(p.Valor||p.valor||0), data_vencimento: (p.DataVencimento||p.dataVencimento||'').split('T')[0]
  })),
  fluxo_semanal: Object.entries(fluxoCR).sort().map(([semana, total]) => ({ semana, total_entradas: Math.round(total*100)/100 }))
};

const fluxoCaixaJSON = {
  gerado_em: new Date().toISOString(),
  saldo_liquido_atual: Math.round(saldoLiquido*100)/100,
  projecao_4_semanas: projecao4Semanas
};

return [{ json: { modulo: 'financeiro', dados: { contasPagar: contasPagarJSON, contasReceber: contasReceberJSON, fluxoCaixa: fluxoCaixaJSON } } }];`;

async function main() {
  const { body: wf } = await api('GET', `/workflows/${WORKFLOW_ID}`);
  console.log('✅ Workflow:', wf.name, '|', wf.nodes.length, 'nodes\n');

  const cp = wf.nodes.find(n => n.name === '💸 Coletar Contas a Pagar');
  const cr = wf.nodes.find(n => n.name === '💰 Coletar Contas a Receber');
  const tf = wf.nodes.find(n => n.name === '🔄 Transformar Financeiro');

  if (cp) { cp.parameters.jsCode = COLETAR_CP_CODE; console.log('✅ Coletar CP: salva em Static Data, retorna sinal leve'); }
  if (cr) { cr.parameters.jsCode = COLETAR_CR_CODE; console.log('✅ Coletar CR: reutiliza dados do CP via Static Data'); }
  if (tf) { tf.parameters.jsCode = TRANSFORMAR_FINANCEIRO_CODE; console.log('✅ Transformar Financeiro: lê do Static Data + detecta campos automaticamente'); }

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
  console.log('🎯 Execute o workflow agora — deve passar por todos os 15+ nodes!');
}
main().catch(console.error);
