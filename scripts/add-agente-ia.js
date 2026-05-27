/**
 * Adiciona ao workflow ativo (5vEtPrd4vzjCBK9w):
 *  - Preparar Prompt IA  (Code) → monta JSON enxuto + system prompt
 *  - OpenAI Chat (gpt-4o) (lmChatOpenAi)
 *  - Agente IA (langchain.agent) → recebe prompt e devolve JSON estruturado
 *  - Parse Insights (Code) → faz parse defensivo e anexa em dados.insights
 *  - Atualiza Ler Dados ERP p/ aceitar modulo=insights
 *
 * Cadeia: Coletar Estoque Grupos Top 10 → Preparar Prompt IA → Agente IA → Parse Insights → Salvar Relatorio
 * Conexão especial: OpenAI Chat → Agente IA via ai_languageModel.
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';
const OPENAI_CRED_ID = 'cCFxJ8gcTdB3fTEk';
const OPENAI_CRED_NAME = 'OpenAI account';

const PREPARAR_PROMPT_CODE = `// ===========================================================
// Monta o payload enxuto para o Agente IA. NUNCA envie raw — só
// summaries + top produtos + grupos. Mantemos numero ja calculado.
// ===========================================================
const item = $input.first().json;
const dados = item.dados || {};

const top = (dados.top_produtos || []).slice(0, 10).map(p => ({
  codigo: p.codigo,
  produto: p.produto,
  quantidade: p.quantidade,
  valor_total: p.valor_total
}));

const grupos = ((dados.estoque_grupos_top10 || {}).grupos || []).map(g => ({
  grupo: g.grupo,
  total_produtos: g.total_produtos,
  total_vendido_hoje: g.total_vendido_hoje,
  total_estoque: g.total_estoque,
  produtos: (g.produtos || []).map(p => ({
    codigo: p.codigo,
    produto: p.produto,
    vendido_hoje: p.vendido_hoje,
    estoque_total: p.estoque_total,
    variacoes_baixas: (p.variacoes || []).filter(v => Number(v.estoque) <= Math.max(5, v.vendido_hoje * 2)).slice(0, 5)
  }))
}));

const payload = {
  data_referencia: dados.data || dados.periodo?.fim,
  janela: dados.janela || 'D-1',
  summary: dados.summary || {},
  top_produtos: top,
  grupos_top10: grupos,
  estoque_summary: (dados.estoque_grupos_top10 || {}).summary || {}
};

const system = [
  'Você é analista sênior de varejo de moda (Tech Malhas, malharia em Franca/SP).',
  'NUNCA invente números — use APENAS os valores do JSON enviado.',
  'Responda APENAS com um objeto JSON válido (sem texto fora do JSON, sem markdown, sem code fences).',
  'Tom: direto, objetivo, português BR. Foco em ação operacional.',
  '',
  'Schema obrigatório de resposta:',
  '{',
  '  "resumo_executivo": "2 a 3 frases sobre o dia, com receita, top produto e principal sinal.",',
  '  "destaques": [',
  '     { "titulo": "string curta", "valor": "string com numero/moeda", "tipo": "positivo|atencao|critico" }',
  '  ],',
  '  "alertas": [',
  '     {',
  '       "tipo": "estoque_critico|estoque_alto|queda_vendas|oportunidade|outro",',
  '       "prioridade": "alta|media|baixa",',
  '       "titulo": "string curta",',
  '       "detalhe": "explicacao breve",',
  '       "produto": "nome (opcional)",',
  '       "link": "/vendas|/estoque|/visao-geral (opcional, sugere onde ver detalhe)"',
  '     }',
  '  ],',
  '  "recomendacoes": [',
  '     {',
  '       "acao": "produzir|repor|promover|investigar|reduzir_compra",',
  '       "prioridade": "alta|media|baixa",',
  '       "produto": "nome (opcional, ou \\\\"diversos\\\\")",',
  '       "motivo": "por que",',
  '       "impacto_esperado": "qual ganho",',
  '       "link": "/vendas|/estoque (opcional)"',
  '     }',
  '  ]',
  '}',
  '',
  'Regras:',
  '- 3 a 5 destaques, 3 a 6 alertas, 3 a 5 recomendacoes (no maximo).',
  '- Alertas duros (prioridade alta) so se o numero suportar: ex. estoque_total < vendido_hoje em alguma variacao = critico.',
  '- Recomendacoes precisam citar produto/grupo concreto sempre que possivel.',
  '- Se nao houver sinal forte para um campo, devolva o array vazio (preferivel a inventar).'
].join('\\n');

const prompt_agente = [
  'Snapshot do dia (D-1):',
  JSON.stringify(payload),
  '',
  'Gere o JSON conforme o schema do system message.'
].join('\\n');

return [{ json: {
  modulo: 'vendas',
  dados,
  prompt_agente,
  system_message: system,
  payload_ia: payload
} }];`;

const PARSE_INSIGHTS_CODE = `// ===========================================================
// Faz parse defensivo da resposta do Agente IA e anexa em
// dados.insights. Se a IA falhar, mantem dados sem insights.
// ===========================================================
const item = $input.first().json;
const dados = item.dados || {};
const raw = item.output || item.text || item.response || '';

function tryParse(text) {
  if (!text || typeof text !== 'string') return null;
  // remove markdown code fences se vier
  let cleaned = text.trim();
  cleaned = cleaned.replace(/^\\s*\\\`\\\`\\\`json\\s*/i, '').replace(/\\s*\\\`\\\`\\\`\\s*$/i, '');
  cleaned = cleaned.replace(/^\\s*\\\`\\\`\\\`\\s*/, '').replace(/\\s*\\\`\\\`\\\`\\s*$/, '');
  try { return JSON.parse(cleaned); } catch {}
  // tenta achar primeiro objeto {...}
  const m = cleaned.match(/\\{[\\s\\S]*\\}/);
  if (m) {
    try { return JSON.parse(m[0]); } catch {}
  }
  return null;
}

const parsed = tryParse(raw);

const insights = parsed && typeof parsed === 'object' ? {
  gerado_em: new Date().toISOString(),
  modelo: 'gpt-4o',
  resumo_executivo: String(parsed.resumo_executivo || '').trim(),
  destaques: Array.isArray(parsed.destaques) ? parsed.destaques.slice(0, 8) : [],
  alertas: Array.isArray(parsed.alertas) ? parsed.alertas.slice(0, 12) : [],
  recomendacoes: Array.isArray(parsed.recomendacoes) ? parsed.recomendacoes.slice(0, 10) : []
} : {
  gerado_em: new Date().toISOString(),
  modelo: 'gpt-4o',
  resumo_executivo: '',
  destaques: [],
  alertas: [],
  recomendacoes: [],
  erro: 'Falha ao interpretar resposta do agente',
  raw: String(raw).slice(0, 500)
};

dados.insights = insights;

return [{ json: { modulo: 'vendas', dados } }];`;

const API_READ_CODE = `// ===========================================================
// Le static data e devolve relatorio (resumo|vendas|estoque|insights)
// ===========================================================
const staticData = $getWorkflowStaticData('global');
const erp = staticData.erp || {};
const query = $input.first().json.query || {};
const modulo = String(query.modulo || 'resumo').toLowerCase();
const dias = Math.max(1, Math.min(Number(query.dias || 1), 120));
const diario = erp.historico?.diario || {};
const datasOrdenadas = Object.keys(diario).sort();
const datasPeriodo = datasOrdenadas.slice(-dias);

const round = (v) => Math.round((Number(v) || 0) * 100) / 100;

function agregarVendas() {
  const diasComVendas = datasPeriodo
    .map(d => ({ data: d, vendas: diario[d]?.vendas }))
    .filter(x => x.vendas);

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
      const cur = produtosMap.get(chave) || {
        codigo: p.codigo,
        produto: p.produto,
        id_produto: p.id_produto || null,
        quantidade: 0,
        valor_total: 0,
        valor_unitario_medio: 0
      };
      cur.quantidade += Number(p.quantidade || 0);
      cur.valor_total += Number(p.valor_total || 0);
      cur.valor_unitario_medio = p.valor_unitario_medio || cur.valor_unitario_medio;
      produtosMap.set(chave, cur);
    }
  }

  const produtos = Array.from(produtosMap.values())
    .map(p => ({
      codigo: p.codigo,
      produto: p.produto,
      id_produto: p.id_produto,
      quantidade: round(p.quantidade),
      valor_unitario_medio: round(p.valor_unitario_medio),
      valor_total: round(p.valor_total)
    }))
    .sort((a, b) => b.quantidade - a.quantidade);

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
    estoque_grupos_top10: ultimoDia.estoque_grupos_top10 || erp.vendas?.estoque_grupos_top10 || null,
    insights: ultimoDia.insights || erp.vendas?.insights || null,
    top_clientes: [],
    por_representante: []
  };
}

const vendasPeriodo = agregarVendas();

if (modulo === 'resumo') {
  const s = vendasPeriodo?.summary || {};
  const insights = vendasPeriodo?.insights;
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
    resumo_executivo: insights?.resumo_executivo || null,
    qt_alertas: (insights?.alertas || []).length,
    qt_recomendacoes: (insights?.recomendacoes || []).length
  } }];
}

if (modulo === 'vendas') {
  if (!vendasPeriodo) return [{ json: { success: false, error: 'Vendas ainda nao coletadas', atualizadoEm: erp.atualizadoEm || null } }];
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo.data || erp.data || null, dados: vendasPeriodo } }];
}

if (modulo === 'estoque') {
  const grupos = vendasPeriodo?.estoque_grupos_top10;
  if (!grupos) return [{ json: { success: false, error: 'Estoque dos grupos top 10 ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: vendasPeriodo?.data || erp.data || null, dados: grupos } }];
}

if (modulo === 'insights') {
  const insights = vendasPeriodo?.insights;
  if (!insights) return [{ json: { success: false, error: 'Insights ainda nao gerados pelo agente IA', atualizadoEm: erp.atualizadoEm || null } }];
  return [{ json: {
    success: true,
    atualizadoEm: erp.atualizadoEm || null,
    data: vendasPeriodo?.data || erp.data || null,
    dados: {
      ...insights,
      summary: vendasPeriodo?.summary || {},
      contexto: {
        receita_total: vendasPeriodo?.summary?.receita_total || 0,
        volume_vendas: vendasPeriodo?.summary?.volume_vendas || 0,
        total_skus: vendasPeriodo?.summary?.total_skus || 0,
        total_grupos: vendasPeriodo?.estoque_grupos_top10?.summary?.total_grupos || 0
      }
    }
  } }];
}

return [{ json: { success: false, error: 'Modulo invalido: ' + modulo, modulos: ['resumo', 'vendas', 'estoque', 'insights'] } }];`;

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
          ...(data
            ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
            : {}),
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
  const { status, body: wf } = await request('GET', `/workflows/${WF_ID}`);
  if (status !== 200) throw new Error(`GET workflow failed: ${status}`);

  // 1. Preparar Prompt IA (Code)
  upsertNode(wf, 'Preparar Prompt IA', (prev) => ({
    id: prev?.id || 'preparar-prompt-ia',
    name: 'Preparar Prompt IA',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [1920, 380],
    parameters: { jsCode: PREPARAR_PROMPT_CODE },
    notes: 'Monta JSON enxuto + system prompt para o Agente IA.',
  }));

  // 2. OpenAI Chat Model (gpt-4o)
  upsertNode(wf, 'OpenAI Chat (gpt-4o)', (prev) => ({
    id: prev?.id || 'openai-chat-gpt4o',
    name: 'OpenAI Chat (gpt-4o)',
    type: '@n8n/n8n-nodes-langchain.lmChatOpenAi',
    typeVersion: 1.2,
    position: [2080, 540],
    parameters: {
      model: { __rl: true, value: 'gpt-4o', mode: 'list' },
      options: { temperature: 0.2, responseFormat: 'json_object' },
    },
    credentials: { openAiApi: { id: OPENAI_CRED_ID, name: OPENAI_CRED_NAME } },
  }));

  // 3. Agente IA
  upsertNode(wf, 'Agente IA', (prev) => ({
    id: prev?.id || 'agente-ia',
    name: 'Agente IA',
    type: '@n8n/n8n-nodes-langchain.agent',
    typeVersion: 1.7,
    position: [2160, 380],
    parameters: {
      promptType: 'define',
      text: '={{ $json.prompt_agente }}',
      options: {
        systemMessage: '={{ $json.system_message }}',
      },
    },
  }));

  // 4. Parse Insights (Code)
  upsertNode(wf, 'Parse Insights', (prev) => ({
    id: prev?.id || 'parse-insights',
    name: 'Parse Insights',
    type: 'n8n-nodes-base.code',
    typeVersion: 2,
    position: [2400, 380],
    parameters: { jsCode: PARSE_INSIGHTS_CODE },
    notes: 'Parse defensivo do JSON retornado pelo Agente IA.',
  }));

  // 5. Atualiza API Ler Dados ERP
  const apiRead = wf.nodes.find((n) => String(n.name || '').includes('Ler Dados ERP'));
  if (!apiRead) throw new Error('Ler Dados ERP não encontrado');
  apiRead.parameters.jsCode = API_READ_CODE;

  // 6. Reorganiza Salvar Relatorio + Notificar para depois do Parse Insights
  const salvar = wf.nodes.find((n) => String(n.name || '').includes('Salvar Relatorio'));
  if (salvar) salvar.position = [2640, 380];
  const notif = wf.nodes.find((n) => String(n.name || '').includes('Notificar Sucesso'));
  if (notif) notif.position = [2880, 380];

  // 7. Conexões: Coletar Estoque Grupos Top 10 → Preparar Prompt IA → Agente IA → Parse Insights → Salvar
  const conns = wf.connections || {};
  conns['Coletar Estoque Grupos Top 10'] = {
    main: [[{ node: 'Preparar Prompt IA', type: 'main', index: 0 }]],
  };
  conns['Preparar Prompt IA'] = {
    main: [[{ node: 'Agente IA', type: 'main', index: 0 }]],
  };
  conns['Agente IA'] = {
    main: [[{ node: 'Parse Insights', type: 'main', index: 0 }]],
  };
  conns['Parse Insights'] = {
    main: [[{ node: 'Salvar Relatorio', type: 'main', index: 0 }]],
  };
  // 8. Conexão especial ai_languageModel: OpenAI Chat -> Agente IA
  conns['OpenAI Chat (gpt-4o)'] = {
    ai_languageModel: [[{ node: 'Agente IA', type: 'ai_languageModel', index: 0 }]],
  };

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const k of allowed) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];

  const payload = { name: wf.name, nodes: wf.nodes, connections: conns, settings };
  const put = await request('PUT', `/workflows/${WF_ID}`, payload);
  if (put.status >= 400) {
    console.error('PUT failed', put.status, JSON.stringify(put.body).slice(0, 600));
    process.exit(1);
  }
  console.log('Workflow atualizado: + Agente IA (gpt-4o) + Parse Insights + API insights');

  const trigger = await new Promise((resolve, reject) => {
    https
      .request({ hostname: HOST, path: '/webhook/atualizar', method: 'POST' }, (res) => {
        let raw = '';
        res.on('data', (c) => (raw += c));
        res.on('end', () => resolve({ status: res.statusCode, body: raw }));
      })
      .on('error', reject)
      .end();
  });
  console.log('Trigger /webhook/atualizar:', trigger.status, trigger.body.slice(0, 200));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
