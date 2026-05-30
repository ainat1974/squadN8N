// ============================================================
// scripts/build-workflow-insights-estoque.js
// Gera o workflow INDEPENDENTE da pagina "Insights IA Estoque" (Paulo PCP).
//
// Fluxo (POST /webhook/coletar-estoque-ia):
//   Webhook -> Definir Periodo -> Autenticar -> Preparar Contexto
//   -> Coletar Vendas PDV -> Transformar Vendas
//   -> Coletar Estoque -> Transformar Estoque
//   -> Calcular ABC + Reposicao Urgente
//   -> Preparar Prompt Paulo -> Paulo (gpt-4o) -> Parse Paulo
//   -> Salvar Insights Estoque
//
// Leitura (GET /webhook/dados-estoque-ia):
//   Webhook -> Ler Insights -> Responder
//
// staticData isolado: staticData.insightsEstoque
// ============================================================
const fs = require('fs');
const path = require('path');
const {
  DEFINIR_PERIODO,
  PREPARAR_CONTEXTO,
  COLETAR_VENDAS,
  TRANSFORMAR_VENDAS,
  COLETAR_ESTOQUE,
  TRANSFORMAR_ESTOQUE,
} = require('./lib/dapic-blocks');

const OUT = path.join('squads', 'n8n-erp-dashboard', 'output', 'workflow-insights-estoque.json');

const OPENAI_CRED_ID = 'cCFxJ8gcTdB3fTEk';
const OPENAI_CRED_NAME = 'OpenAI account';

// ===== Calculo deterministico de Curva ABC + Reposicao urgente =====
// Roda APOS Transformar Vendas e Transformar Estoque. Cruza vendido do
// intervalo com saldo de estoque para gerar:
//  - reposicao_urgente: top 30 variacoes com menor cobertura (em dias)
//  - curva_abc.resumo: 3 cards (A/B/C) com % SKUs, % receita, ticket, cobertura
//  - curva_abc.detalhes: top 30 SKUs por receita com classe atribuida
const CALCULAR_ABC = `const ctx = $('Preparar Contexto').first().json;
let vendas = {};
try { vendas = $('Transformar Vendas').first().json.dados || {}; } catch (e) {}
let estoque = {};
try { estoque = $('Transformar Estoque').first().json.dados || {}; } catch (e) {}

const linhasEst = estoque.linhas || [];
const produtos = vendas.produtos_vendidos || [];
const dias = Math.max(1, Number(ctx.diasIntervalo || 1));

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;
const round1 = (v) => Math.round((Number(v) || 0) * 10) / 10;

// REPOSICAO URGENTE: cobertura = estoque / (vendido / diasIntervalo)
// Considera somente linhas com vendido > 0 (so faz sentido reposicao do
// que esta girando). Ordena por cobertura crescente (menor primeiro).
const reposicaoCandidatos = linhasEst
  .filter(l => Number(l.vendido_hoje || 0) > 0)
  .map(l => {
    const vendido = Number(l.vendido_hoje || 0);
    const estoque_atual = Number(l.estoque_atual || 0);
    const velocidade = vendido / dias;
    const cobertura_dias = velocidade > 0 ? round1(estoque_atual / velocidade) : 0;
    let urgencia = 'medio';
    if (cobertura_dias < 2) urgencia = 'critico';
    else if (cobertura_dias < 7) urgencia = 'alto';
    return {
      codigo: l.codigo || '',
      produto: l.produto || '',
      variacao: [l.cor, l.tamanho].filter(Boolean).join(' / ') || '—',
      estoque_atual,
      vendido_periodo: vendido,
      cobertura_dias,
      urgencia
    };
  })
  .sort((a, b) => a.cobertura_dias - b.cobertura_dias)
  .slice(0, 30);

// CURVA ABC: classifica por receita acumulada no intervalo
// A = primeiros que somam ate 80% da receita
// B = proximos ate 95%
// C = resto
const totalReceita = produtos.reduce((s, p) => s + Number(p.valor_total || 0), 0);
let acumulado = 0;
const detalhesAbc = [];
let posicao = 0;
let countA = 0, countB = 0, countC = 0;
let recA = 0, recB = 0, recC = 0;
let tckA = 0, tckB = 0, tckC = 0;

for (const p of produtos) {
  posicao++;
  const receita = Number(p.valor_total || 0);
  const qtd = Number(p.quantidade || 0);
  acumulado += receita;
  const pctAcum = totalReceita > 0 ? (acumulado / totalReceita) * 100 : 0;
  let classe = 'C';
  if (pctAcum <= 80) classe = 'A';
  else if (pctAcum <= 95) classe = 'B';

  if (classe === 'A') { countA++; recA += receita; tckA += Number(p.valor_unitario_medio || 0); }
  else if (classe === 'B') { countB++; recB += receita; tckB += Number(p.valor_unitario_medio || 0); }
  else { countC++; recC += receita; tckC += Number(p.valor_unitario_medio || 0); }

  if (detalhesAbc.length < 30) {
    detalhesAbc.push({
      posicao, classe,
      codigo: p.codigo || '',
      produto: p.produto || '',
      variacao: '',
      vendido: qtd,
      receita: round(receita),
      pct_receita: round1(totalReceita > 0 ? (receita / totalReceita) * 100 : 0)
    });
  }
}

const totalSkus = produtos.length || 1;
// cobertura media por classe usando linhas de estoque que tem vendido
const linhasComCob = reposicaoCandidatos;
const mediaCobertura = (arr) => {
  if (!arr || arr.length === 0) return 0;
  return round1(arr.reduce((s, x) => s + Number(x.cobertura_dias || 0), 0) / arr.length);
};

const resumoAbc = [
  {
    classe: 'A', skus: countA,
    percentual_skus: round1((countA / totalSkus) * 100),
    percentual_receita: round1((recA / Math.max(1, totalReceita)) * 100),
    ticket_medio: countA > 0 ? round(tckA / countA) : 0,
    cobertura_media_dias: mediaCobertura(linhasComCob.slice(0, Math.max(1, Math.min(linhasComCob.length, countA)))),
    descricao: 'Top de vendas — concentram a maior parte da receita. Acompanhamento diario, cobertura minima critica.'
  },
  {
    classe: 'B', skus: countB,
    percentual_skus: round1((countB / totalSkus) * 100),
    percentual_receita: round1((recB / Math.max(1, totalReceita)) * 100),
    ticket_medio: countB > 0 ? round(tckB / countB) : 0,
    cobertura_media_dias: mediaCobertura(linhasComCob.slice(countA, countA + countB)),
    descricao: 'Camada intermediaria — boa rotacao, cobertura confortavel. Monitorar semanalmente.'
  },
  {
    classe: 'C', skus: countC,
    percentual_skus: round1((countC / totalSkus) * 100),
    percentual_receita: round1((recC / Math.max(1, totalReceita)) * 100),
    ticket_medio: countC > 0 ? round(tckC / countC) : 0,
    cobertura_media_dias: mediaCobertura(linhasComCob.slice(countA + countB)),
    descricao: 'Longa cauda — baixa rotacao. Concentra capital parado, candidatos a liquidacao/descontinuacao.'
  }
];

return [{ json: {
  reposicao_urgente: reposicaoCandidatos,
  curva_abc: { resumo: resumoAbc, detalhes: detalhesAbc },
  diagnostico_numerico: {
    total_skus_vendidos: totalSkus,
    total_receita: round(totalReceita),
    skus_classe_a: countA,
    skus_classe_b: countB,
    skus_classe_c: countC,
    capital_parado_estimado: round((estoque.summary && estoque.summary.valor_total_estoque) || 0) - round(totalReceita),
    rupturas_iminentes: reposicaoCandidatos.filter(r => r.urgencia === 'critico').length,
    dias_intervalo: dias
  }
} }];`;

// ===== AGENTE PAULO (PCP / Operacoes) =====
const PREPARAR_PROMPT_PAULO = `const ctx = $('Preparar Contexto').first().json;
let vendas = {}, estoque = {}, abc = {};
try { vendas = $('Transformar Vendas').first().json.dados || {}; } catch (e) {}
try { estoque = $('Transformar Estoque').first().json.dados || {}; } catch (e) {}
try { abc = $('Calcular ABC').first().json || {}; } catch (e) {}

const num = (v) => Number(v || 0) || 0;
const vs = vendas.summary || {};
const es = estoque.summary || {};

const payload = {
  periodo: { inicio: ctx.dataInicial, fim: ctx.dataFinal, dias_intervalo: ctx.diasIntervalo || 1 },
  vendas: {
    receita: num(vs.receita_total),
    volume: num(vs.volume_vendas),
    ticket_medio: num(vs.ticket_medio),
    total_skus_vendidos: num(vs.total_skus)
  },
  estoque: {
    total_skus: num(es.total_skus),
    skus_criticos: num(es.skus_criticos),
    skus_alerta: num(es.skus_alerta),
    capital_estoque: num(es.valor_total_estoque),
    total_vendido_hoje: num(es.total_vendido_hoje)
  },
  curva_abc_resumo: (abc.curva_abc && abc.curva_abc.resumo) || [],
  reposicao_urgente_top10: (abc.reposicao_urgente || []).slice(0, 10),
  top_produtos: (vendas.produtos_vendidos || []).slice(0, 15)
};

const system = [
  'Voce e Paulo, doutor (PhD) em Planejamento e Controle de Producao (PCP) e Operacoes, consultor senior da Tech Malhas (malharia em Franca/SP). Atue como mentor: alem de diagnosticar, EXPLIQUE o raciocinio para que o gestor aprenda a ler os proprios numeros.',
  'CONTEXTO TEMPORAL: sua analise e PONTUAL e refere-se ao intervalo selecionado (' + ctx.dataInicial + ' a ' + ctx.dataFinal + '). Vendas e giro seguem o intervalo. O estoque e SEMPRE posicao atual (snapshot) — a Dapic nao mantem historico. Sempre deixe claro no resumo que a leitura e do intervalo analisado.',
  'Dominios que voce aplica: gestao de estoque (cobertura, giro, ruptura), curva ABC e principio de Pareto aplicado a SKU, mix descalibrado, capital empoçado em variacoes de baixa rotacao, politica de reposicao por classe.',
  'NUNCA invente numeros — use APENAS os valores do JSON enviado. Sempre que citar um conceito tecnico (giro, cobertura, ABC, ruptura), explique-o em linguagem simples.',
  'Responda APENAS com um objeto JSON valido (sem markdown, sem code fences, sem texto fora do JSON).',
  'Tom: especialista que orienta — claro, didatico, objetivo, portugues BR, foco em decisao.',
  '',
  'Schema obrigatorio:',
  '{',
  '  "resumo_executivo": "2 a 3 frases citando o intervalo (' + ctx.dataInicial + ' a ' + ctx.dataFinal + '), SKUs criticos, capital em estoque e o principal risco de ruptura.",',
  '  "diagnostico": "1 paragrafo (4 a 6 frases) explicando O QUE os numeros revelam e POR QUE importa. Conecte causa e efeito como um orientador.",',
  '  "metodologia": "2 a 4 frases dizendo quais metricas/frameworks usou (ABC, cobertura em dias, ruptura) e como o gestor deve interpreta-las.",',
  '  "saude_estoque": "boa|atencao|critica",',
  '  "blocos": [ { "prioridade": 1, "severidade": "critico|atencao|ok", "categoria": "rotulo curto (ex.: Ruptura iminente, Capital parado, Mix descalibrado)", "titulo": "frase curta de destaque", "valor": "numero/moeda principal (opcional)", "conteudo": "1 a 3 frases explicando o achado e a acao sugerida" } ],',
  '  "indicadores": [ { "label": "string", "valor": "string com numero/moeda", "tom": "positivo|atencao|critico" } ],',
  '  "alertas": [ { "prioridade": "alta|media|baixa", "tipo": "ruptura|capital_parado|mix|outro", "titulo": "string", "detalhe": "string" } ],',
  '  "recomendacoes": [ { "prioridade": "alta|media|baixa", "acao": "repor|promover|descontinuar|monitorar", "produto": "nome ou diversos", "motivo": "string", "fundamentacao": "por que esta acao, ancorada em conceito de PCP (ex.: politica de cobertura minima por classe ABC)", "impacto_esperado": "string" } ],',
  '  "glossario": [ { "termo": "string", "definicao": "explicacao curta e simples" } ]',
  '}',
  '',
  'REGRA DOS BLOCOS: "blocos" e a leitura priorizada da pagina. Devolva de 3 a 6 blocos ORDENADOS por prioridade (1 = mais importante NESTE INTERVALO). Use "critico" para risco que exige acao imediata, "atencao" para acompanhar, "ok" para saudavel.',
  'Regras: 3 a 6 blocos, 4 a 6 indicadores, 2 a 5 alertas, 2 a 5 recomendacoes, 3 a 5 termos no glossario. Cite SKUs concretos do reposicao_urgente_top10 quando fizer sentido.'
].join('\\n');

const prompt_agente = ['Dados de estoque/PCP do periodo:', JSON.stringify(payload), '', 'Gere o JSON conforme o schema do system message.'].join('\\n');

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

function normBlocos(arr) {
  if (!Array.isArray(arr)) return [];
  const sevOk = { critico: 1, atencao: 1, ok: 1 };
  return arr
    .map((b, i) => ({
      prioridade: Number(b && b.prioridade) || (i + 1),
      severidade: sevOk[String(b && b.severidade || '').toLowerCase()] ? String(b.severidade).toLowerCase() : 'atencao',
      categoria: String(b && b.categoria || '').trim(),
      titulo: String(b && b.titulo || '').trim(),
      valor: b && b.valor != null ? String(b.valor) : '',
      conteudo: String(b && b.conteudo || '').trim()
    }))
    .filter(b => b.titulo || b.conteudo)
    .sort((a, b) => a.prioridade - b.prioridade)
    .slice(0, 6);
}

const p = tryParse(raw);
const base = { gerado_em: new Date().toISOString(), modelo: 'gpt-4o', agente: 'Paulo PCP', contexto: ctx };
const analise = (p && typeof p === 'object') ? {
  ...base,
  resumo_executivo: String(p.resumo_executivo || '').trim(),
  diagnostico: String(p.diagnostico || '').trim(),
  metodologia: String(p.metodologia || '').trim(),
  saude_estoque: p.saude_estoque || 'atencao',
  blocos: normBlocos(p.blocos),
  indicadores: Array.isArray(p.indicadores) ? p.indicadores.slice(0, 6) : [],
  alertas: Array.isArray(p.alertas) ? p.alertas.slice(0, 8) : [],
  recomendacoes: Array.isArray(p.recomendacoes) ? p.recomendacoes.slice(0, 8) : [],
  glossario: Array.isArray(p.glossario) ? p.glossario.slice(0, 6) : []
} : {
  ...base,
  resumo_executivo: '',
  diagnostico: '',
  metodologia: '',
  saude_estoque: 'indisponivel',
  blocos: [], indicadores: [], alertas: [], recomendacoes: [], glossario: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 400)
};

return [{ json: { analiseEstoque: analise } }];`;

const SALVAR_INSIGHTS = `const staticData = $getWorkflowStaticData('global');
const ctx = $('Preparar Contexto').first().json;

let vendas = null, estoque = null, abc = null, analise = null;
try { vendas = $('Transformar Vendas').first().json.dados || null; } catch (e) {}
try { estoque = $('Transformar Estoque').first().json.dados || null; } catch (e) {}
try { abc = $('Calcular ABC').first().json || null; } catch (e) {}
try { analise = $('Parse Paulo').first().json.analiseEstoque || null; } catch (e) {}

const atualizadoEm = new Date().toISOString();

// Anexa reposicao_urgente e curva_abc DETERMINISTICOS na analise (frontend
// usa esses arrays para a tabela; o agente complementa com texto e blocos).
const analiseFinal = analise ? {
  ...analise,
  reposicao_urgente: (abc && abc.reposicao_urgente) || [],
  curva_abc: (abc && abc.curva_abc) || { resumo: [], detalhes: [] },
  periodo: { inicio: ctx.dataInicial, fim: ctx.dataFinal }
} : null;

staticData.insightsEstoque = {
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  dataExecucao: ctx.dataHoje,
  janelaColeta: ctx.janelaColeta,
  limiteAplicado: ctx.limiteAplicado || false,
  maxDias: ctx.maxDias || 90,
  atualizadoEm,
  vendas: vendas ? { summary: vendas.summary, total_produtos: (vendas.produtos_vendidos || []).length } : null,
  estoque: estoque ? { summary: estoque.summary, total_linhas: (estoque.linhas || []).length } : null,
  analiseEstoque: analiseFinal
};

return [{ json: {
  sucesso: true,
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  limiteAplicado: ctx.limiteAplicado || false,
  atualizadoEm,
  resumo: analiseFinal?.resumo_executivo || null
} }];`;

const LER_INSIGHTS = `const staticData = $getWorkflowStaticData('global');
const snap = staticData.insightsEstoque || null;

if (!snap) {
  return [{ json: { success: false, error: 'Nenhuma analise de estoque coletada ainda. Selecione o intervalo e clique em Atualizar.' } }];
}

return [{ json: {
  success: true,
  dataInicial: snap.dataInicial,
  dataFinal: snap.dataFinal,
  dataExecucao: snap.dataExecucao,
  janelaColeta: snap.janelaColeta,
  limiteAplicado: snap.limiteAplicado || false,
  maxDias: snap.maxDias || 90,
  atualizadoEm: snap.atualizadoEm,
  gerado_em: snap.analiseEstoque?.gerado_em || snap.atualizadoEm,
  analise: snap.analiseEstoque || null,
  vendas: snap.vendas || null,
  estoque: snap.estoque || null
} }];`;

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
  name: 'Tech Malhas - Insights IA Estoque',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'coletar-estoque-ia', responseMode: 'onReceived', options: {} },
      id: 'trigger-webhook', name: 'Webhook Coletar', type: 'n8n-nodes-base.webhook', typeVersion: 1.1,
      position: [240, 400], webhookId: 'insights-estoque-coletar',
      notes: 'POST /webhook/coletar-estoque-ia body: { dataInicial, dataFinal } YYYY-MM-DD',
    },
    code('definir-periodo', 'Definir Periodo', DEFINIR_PERIODO, [480, 400]),
    authNode,
    code('preparar-contexto', 'Preparar Contexto', PREPARAR_CONTEXTO, [960, 400]),
    code('coletar-vendas', 'Coletar Vendas PDV', COLETAR_VENDAS, [1200, 400]),
    code('transformar-vendas', 'Transformar Vendas', TRANSFORMAR_VENDAS, [1440, 400]),
    code('coletar-estoque', 'Coletar Estoque', COLETAR_ESTOQUE, [1680, 400], { continueOnFail: true, notes: 'Snapshot atual' }),
    code('transformar-estoque', 'Transformar Estoque', TRANSFORMAR_ESTOQUE, [1920, 400], { continueOnFail: true }),
    code('calcular-abc', 'Calcular ABC', CALCULAR_ABC, [2160, 400], { notes: 'Curva ABC + reposicao urgente (deterministico)' }),
    code('preparar-prompt-paulo', 'Preparar Prompt Paulo', PREPARAR_PROMPT_PAULO, [2400, 400]),
    {
      parameters: {
        model: { __rl: true, value: 'gpt-4o', mode: 'list' },
        options: { temperature: 0.2, responseFormat: 'json_object' },
      },
      id: 'openai-paulo',
      name: 'OpenAI Paulo (gpt-4o)',
      type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
      typeVersion: 1.2,
      position: [2400, 600],
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
      position: [2580, 400],
      continueOnFail: true,
    },
    code('parse-paulo', 'Parse Paulo', PARSE_PAULO, [2760, 400], { continueOnFail: true }),
    code('salvar-insights', 'Salvar Insights', SALVAR_INSIGHTS, [2940, 400]),
    {
      parameters: { httpMethod: 'GET', path: 'dados-estoque-ia', responseMode: 'responseNode', options: {} },
      id: 'api-webhook', name: 'API GET /dados', type: 'n8n-nodes-base.webhook', typeVersion: 1.1,
      position: [240, 720], webhookId: 'insights-estoque-dados',
    },
    code('api-read-static', 'Ler Insights', LER_INSIGHTS, [480, 720]),
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
    {
      parameters: {
        content:
          '## Insights IA Estoque (Paulo PCP)\\n\\nWorkflow independente da pagina.\\n\\n### Coleta\\nPOST `/webhook/coletar-estoque-ia`\\n```json\\n{ "dataInicial": "2026-04-01", "dataFinal": "2026-04-30" }\\n```\\n\\n### Leitura\\nGET `/webhook/dados-estoque-ia`\\n\\nLe `staticData.insightsEstoque`. Teto de 90 dias (3 meses).',
        height: 280, width: 420, color: 4,
      },
      id: 'nota-config', name: 'Instrucoes', type: 'n8n-nodes-base.stickyNote', typeVersion: 1, position: [240, 80],
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
    'Transformar Estoque': { main: [[{ node: 'Calcular ABC', type: 'main', index: 0 }]] },
    'Calcular ABC': { main: [[{ node: 'Preparar Prompt Paulo', type: 'main', index: 0 }]] },
    'Preparar Prompt Paulo': { main: [[{ node: 'Paulo PCP', type: 'main', index: 0 }]] },
    'OpenAI Paulo (gpt-4o)': { ai_languageModel: [[{ node: 'Paulo PCP', type: 'ai_languageModel', index: 0 }]] },
    'Paulo PCP': { main: [[{ node: 'Parse Paulo', type: 'main', index: 0 }]] },
    'Parse Paulo': { main: [[{ node: 'Salvar Insights', type: 'main', index: 0 }]] },
    'API GET /dados': { main: [[{ node: 'Ler Insights', type: 'main', index: 0 }]] },
    'Ler Insights': { main: [[{ node: 'Responder API', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: { executionOrder: 'v1', saveManualExecutions: true, timezone: 'America/Sao_Paulo', executionTimeout: 480 },
  pinData: {},
  meta: { version: '1.0.0', scope: 'insights-estoque', builtAt: new Date().toISOString() },
  tags: [{ name: 'erp' }, { name: 'dapic' }, { name: 'tech-malhas' }, { name: 'insights-ia' }],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('Workflow Insights IA Estoque gerado:', OUT);
console.log('   Nodes:', workflow.nodes.length);
