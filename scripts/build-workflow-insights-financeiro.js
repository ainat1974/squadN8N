// ============================================================
// scripts/build-workflow-insights-financeiro.js
// Gera o workflow INDEPENDENTE da pagina "Insights IA Financeiro".
//
// Fluxo (POST /webhook/coletar-financeiro-ia):
//   Webhook -> Definir Periodo -> Autenticar -> Preparar Contexto
//   -> Coletar Financeiro -> Transformar Financeiro
//   -> Preparar Prompt Fernanda -> Fernanda (gpt-4o) -> Parse Fernanda
//   -> Salvar Insights
//
// Leitura (GET /webhook/dados-financeiro-ia):
//   Webhook -> Ler Insights -> Responder
//
// staticData isolado deste workflow: staticData.insightsFinanceiro
// ============================================================
const fs = require('fs');
const path = require('path');
const {
  DEFINIR_PERIODO,
  PREPARAR_CONTEXTO,
  COLETAR_FINANCEIRO,
  TRANSFORMAR_FINANCEIRO,
} = require('./lib/dapic-blocks');

const OUT = path.join('squads', 'n8n-erp-dashboard', 'output', 'workflow-insights-financeiro.json');

const OPENAI_CRED_ID = 'cCFxJ8gcTdB3fTEk';
const OPENAI_CRED_NAME = 'OpenAI account';

// ===================== AGENTE FERNANDA (FINANCEIRO, standalone) =====================
// Diferenca para o v3: nao depende de Vendas (workflow dedicado ao financeiro)
// e devolve "blocos" (quadrantes dinamicos priorizados por severidade).
const PREPARAR_PROMPT_FERNANDA = `const ctx = $('Preparar Contexto').first().json;
const fin = $('Transformar Financeiro').first().json || {};
const cr = fin.contasReceber || { summary: {}, aging: {}, top_devedores: [] };
const fc = fin.fluxoCaixa || { summary: {}, projecao_4_semanas: [] };

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
  inadimplencia: {
    total_vencido: totalVencido,
    pct_sobre_aberto: totalReceber > 0 ? Math.round((totalVencido / totalReceber) * 1000) / 10 : 0,
    aging: cr.aging || {},
    qt_titulos_vencidos: num(cr.summary.qt_vencido),
    concentracao_top1_pct: concentracaoTop1,
    top_devedores: topDev
  },
  projecao_caixa: {
    metodo: fc.metodo_projecao || 'media_movel_entradas_realizadas',
    media_diaria_entradas: num(fc.summary.media_diaria_entradas),
    media_semanal_entradas: num(fc.summary.media_semanal_entradas),
    dias_base: num(fc.summary.dias_janela),
    proximas_4_semanas: fc.projecao_4_semanas || [],
    total_4_semanas: num(fc.summary.projecao_4_semanas_total)
  },
  contas_a_pagar_disponivel: false
};

const system = [
  'Voce e Fernanda, doutora (PhD) em Financas e consultora senior de gestao financeira da Tech Malhas (malharia em Franca/SP). Atue como mentora: alem de diagnosticar, EXPLIQUE o raciocinio para que o gestor aprenda a ler os proprios numeros.',
  'CONTEXTO TEMPORAL: sua analise e PONTUAL e refere-se aos eventos ocorridos no intervalo selecionado (' + ctx.dataInicial + ' a ' + ctx.dataFinal + '). Caixa recebido (entradas) e recebiveis com vencimento no periodo seguem esse intervalo. O atraso/aging dos recebiveis e medido em relacao a HOJE (posicao atual). Sempre deixe claro no resumo que a leitura e do intervalo analisado, nao um acumulado historico.',
  'Dominios que voce aplica quando os dados permitem: gestao de capital de giro e ciclo de caixa, prazo medio de recebimento (DSO/PMR), aging de recebiveis e provisao para inadimplencia, risco de credito e concentracao de carteira, regua de cobranca e politica de credito.',
  'NUNCA invente numeros — use APENAS os valores do JSON enviado. Sempre que citar um conceito tecnico (ex.: DSO, aging, concentracao), explique-o em linguagem simples.',
  'IMPORTANTE: contas a pagar/despesas NAO estao disponiveis nesta fonte (contas_a_pagar_disponivel=false). NAO faca afirmacoes sobre despesas, lucro ou DRE.',
  'PROJECAO DE CAIXA: a loja recebe majoritariamente a vista (cartao/pix), entao quase nao ha recebiveis a prazo em aberto. A projecao_caixa.proximas_4_semanas e uma ESTIMATIVA baseada na media movel das entradas realizadas (media_semanal_entradas) somada a eventuais parcelas a prazo a vencer. Trate-a como estimativa de ritmo de recebimento, NAO como nula. Comente o caixa medio semanal esperado.',
  'Responda APENAS com um objeto JSON valido (sem markdown, sem code fences, sem texto fora do JSON).',
  'Tom: de especialista que orienta — claro, didatico e objetivo, portugues BR, foco em decisao. Nenhum jargao sem explicacao.',
  '',
  'Schema obrigatorio:',
  '{',
  '  "resumo_executivo": "2 a 3 frases citando o intervalo analisado (' + ctx.dataInicial + ' a ' + ctx.dataFinal + '), caixa recebido, total a receber e o principal risco de inadimplencia.",',
  '  "diagnostico": "1 paragrafo (4 a 6 frases) explicando O QUE os numeros do intervalo revelam e POR QUE importa, conectando causa e efeito como um orientador faria. Aponte o que e saudavel e o que preocupa.",',
  '  "metodologia": "2 a 4 frases dizendo quais metricas/frameworks voce usou (ex.: aging, indice de concentracao, media movel de caixa) e como o gestor deve interpreta-las.",',
  '  "saude_financeira": "boa|atencao|critica",',
  '  "blocos": [ { "prioridade": 1, "severidade": "critico|atencao|ok", "categoria": "rotulo curto (ex.: Inadimplencia, Caixa, Concentracao de carteira, Recebiveis)", "titulo": "frase curta de destaque", "valor": "numero/moeda principal do bloco (opcional)", "conteudo": "1 a 3 frases explicando o achado e a acao sugerida" } ],',
  '  "indicadores": [ { "label": "string", "valor": "string com moeda/numero", "tom": "positivo|atencao|critico" } ],',
  '  "alertas": [ { "prioridade": "alta|media|baixa", "tipo": "inadimplencia|concentracao_cliente|fluxo_caixa|outro", "titulo": "string", "detalhe": "string" } ],',
  '  "recomendacoes": [ { "prioridade": "alta|media|baixa", "acao": "cobrar|renegociar|monitorar|investigar", "cliente": "nome ou diversos", "motivo": "string", "fundamentacao": "por que esta acao, ancorada em um conceito financeiro (ex.: reduzir DSO melhora o ciclo de caixa)", "impacto_esperado": "string" } ],',
  '  "glossario": [ { "termo": "string", "definicao": "explicacao curta e simples do termo usado na analise" } ]',
  '}',
  '',
  'REGRA DOS BLOCOS (o mais importante): "blocos" e a leitura priorizada da pagina. Devolva de 3 a 6 blocos ORDENADOS por prioridade (1 = mais importante PARA A GESTAO FINANCEIRA NESTE INTERVALO). Escolha o que e de fato mais relevante agora — nao siga uma ordem fixa. Use severidade "critico" para risco que exige acao imediata, "atencao" para acompanhar, "ok" para o que esta saudavel.',
  'Regras: 3 a 6 blocos, 3 a 5 indicadores, 2 a 5 alertas, 2 a 5 recomendacoes, 3 a 5 termos no glossario (apenas os realmente usados). Cite clientes concretos do top_devedores quando fizer sentido. Se faltar sinal, devolva array vazio.'
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
const base = { gerado_em: new Date().toISOString(), modelo: 'gpt-4o', agente: 'Fernanda Financeiro', contexto: ctx };
const analise = (p && typeof p === 'object') ? {
  ...base,
  resumo_executivo: String(p.resumo_executivo || '').trim(),
  diagnostico: String(p.diagnostico || '').trim(),
  metodologia: String(p.metodologia || '').trim(),
  saude_financeira: p.saude_financeira || 'atencao',
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
  saude_financeira: 'indisponivel',
  blocos: [], indicadores: [], alertas: [], recomendacoes: [], glossario: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 400)
};

return [{ json: { analiseFinanceira: analise } }];`;

const SALVAR_INSIGHTS = `const staticData = $getWorkflowStaticData('global');
const ctx = $('Preparar Contexto').first().json;

let financeiro = null;
try { financeiro = $('Transformar Financeiro').first().json || null; } catch (e) {}

let analiseFinanceira = null;
try { analiseFinanceira = $('Parse Fernanda').first().json.analiseFinanceira || null; } catch (e) {}

const atualizadoEm = new Date().toISOString();

staticData.insightsFinanceiro = {
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  dataExecucao: ctx.dataHoje,
  janelaColeta: ctx.janelaColeta,
  limiteAplicado: ctx.limiteAplicado || false,
  maxDias: ctx.maxDias || 90,
  atualizadoEm,
  contasReceber: financeiro?.contasReceber || null,
  fluxoCaixa: financeiro?.fluxoCaixa || null,
  analiseFinanceira
};

return [{ json: {
  sucesso: true,
  dataInicial: ctx.dataInicial,
  dataFinal: ctx.dataFinal,
  limiteAplicado: ctx.limiteAplicado || false,
  atualizadoEm,
  resumo: analiseFinanceira?.resumo_executivo || null
} }];`;

const LER_INSIGHTS = `const staticData = $getWorkflowStaticData('global');
const snap = staticData.insightsFinanceiro || null;

if (!snap) {
  return [{ json: { success: false, error: 'Nenhuma analise financeira coletada ainda. Selecione o intervalo e clique em Atualizar.' } }];
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
  gerado_em: snap.analiseFinanceira?.gerado_em || snap.atualizadoEm,
  analise: snap.analiseFinanceira || null,
  contasReceber: snap.contasReceber || null,
  fluxoCaixa: snap.fluxoCaixa || null
} }];`;

const workflow = {
  name: 'Tech Malhas - Insights IA Financeiro',
  nodes: [
    {
      parameters: { httpMethod: 'POST', path: 'coletar-financeiro-ia', responseMode: 'onReceived', options: {} },
      id: 'trigger-webhook',
      name: 'Webhook Coletar',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [240, 400],
      webhookId: 'insights-financeiro-coletar',
      notes: 'POST /webhook/coletar-financeiro-ia body: { dataInicial, dataFinal } YYYY-MM-DD',
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
      parameters: { jsCode: COLETAR_FINANCEIRO },
      id: 'coletar-financeiro',
      name: 'Coletar Financeiro',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1200, 400],
      continueOnFail: true,
      notes: 'Contas a Receber (parcelas) + entradas (pagamentos) do intervalo',
    },
    {
      parameters: { jsCode: TRANSFORMAR_FINANCEIRO },
      id: 'transformar-financeiro',
      name: 'Transformar Financeiro',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1440, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PREPARAR_PROMPT_FERNANDA },
      id: 'preparar-prompt-fernanda',
      name: 'Preparar Prompt Fernanda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, 400],
      notes: 'Monta payload financeiro + system prompt (com blocos dinamicos).',
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
      position: [1680, 600],
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
      position: [1860, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: PARSE_FERNANDA },
      id: 'parse-fernanda',
      name: 'Parse Fernanda',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2040, 400],
      continueOnFail: true,
    },
    {
      parameters: { jsCode: SALVAR_INSIGHTS },
      id: 'salvar-insights',
      name: 'Salvar Insights',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [2220, 400],
    },
    {
      parameters: { httpMethod: 'GET', path: 'dados-financeiro-ia', responseMode: 'responseNode', options: {} },
      id: 'api-webhook',
      name: 'API GET /dados',
      type: 'n8n-nodes-base.webhook',
      typeVersion: 1.1,
      position: [240, 720],
      webhookId: 'insights-financeiro-dados',
    },
    {
      parameters: { jsCode: LER_INSIGHTS },
      id: 'api-read-static',
      name: 'Ler Insights',
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
          '## Insights IA Financeiro (Fernanda)\\n\\nWorkflow independente da pagina.\\n\\n### Coleta\\nPOST `/webhook/coletar-financeiro-ia`\\n```json\\n{ "dataInicial": "2026-04-01", "dataFinal": "2026-04-30" }\\n```\\n\\n### Leitura\\nGET `/webhook/dados-financeiro-ia`\\n\\nLe `staticData.insightsFinanceiro` (isolado deste workflow). Teto de 90 dias (3 meses).',
        height: 280,
        width: 420,
        color: 4,
      },
      id: 'nota-config',
      name: 'Instrucoes',
      type: 'n8n-nodes-base.stickyNote',
      typeVersion: 1,
      position: [240, 80],
    },
  ],
  connections: {
    'Webhook Coletar': { main: [[{ node: 'Definir Periodo', type: 'main', index: 0 }]] },
    'Definir Periodo': { main: [[{ node: '🔐 Autenticar Dapic', type: 'main', index: 0 }]] },
    '🔐 Autenticar Dapic': { main: [[{ node: 'Preparar Contexto', type: 'main', index: 0 }]] },
    'Preparar Contexto': { main: [[{ node: 'Coletar Financeiro', type: 'main', index: 0 }]] },
    'Coletar Financeiro': { main: [[{ node: 'Transformar Financeiro', type: 'main', index: 0 }]] },
    'Transformar Financeiro': { main: [[{ node: 'Preparar Prompt Fernanda', type: 'main', index: 0 }]] },
    'Preparar Prompt Fernanda': { main: [[{ node: 'Fernanda Financeiro', type: 'main', index: 0 }]] },
    'OpenAI Fernanda (gpt-4o)': { ai_languageModel: [[{ node: 'Fernanda Financeiro', type: 'ai_languageModel', index: 0 }]] },
    'Fernanda Financeiro': { main: [[{ node: 'Parse Fernanda', type: 'main', index: 0 }]] },
    'Parse Fernanda': { main: [[{ node: 'Salvar Insights', type: 'main', index: 0 }]] },
    'API GET /dados': { main: [[{ node: 'Ler Insights', type: 'main', index: 0 }]] },
    'Ler Insights': { main: [[{ node: 'Responder API', type: 'main', index: 0 }]] },
  },
  active: false,
  settings: {
    executionOrder: 'v1',
    saveManualExecutions: true,
    timezone: 'America/Sao_Paulo',
    executionTimeout: 300,
  },
  pinData: {},
  meta: { version: '1.0.0', scope: 'insights-financeiro', builtAt: new Date().toISOString() },
  tags: [{ name: 'erp' }, { name: 'dapic' }, { name: 'tech-malhas' }, { name: 'insights-ia' }],
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(workflow, null, 2));
console.log('✅ Workflow Insights IA Financeiro gerado:', OUT);
console.log('   Nodes:', workflow.nodes.length);
