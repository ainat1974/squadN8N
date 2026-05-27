/**
 * Adiciona ao workflow ativo:
 *  - Novo nó "Coletar Estoque Grupos Top 10" que, para cada Grupo dos top 10
 *    mais vendidos, busca o estoque de TODOS os produtos vendidos hoje que
 *    pertencem a esses grupos (ainda que não estejam pessoalmente no top 10).
 *  - API "Ler Dados ERP" passa a expor `modulo=estoque` (com summary/grupos/linhas).
 *
 * Sequência: Transformar Vendas → Coletar Estoque Top 10 → Coletar Estoque Grupos Top 10 → Salvar Relatorio
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

const COLETAR_GRUPOS_CODE = `// ===========================================================
// Coleta o estoque atual dos produtos vendidos hoje que estao
// dentro do(s) Grupo(s) dos top 10 mais vendidos.
// ===========================================================
const item = $input.first().json;
const dados = item.dados || {};
const top = (dados.top_produtos || []).slice(0, 10);
const ctx = $('Preparar Contexto').first().json;
const baseUrl = ctx.baseUrl || 'https://api.dapic.com.br';
let token = ctx.token;

const raw = $('Coletar Vendas PDV').first().json.produtosVendidos || [];

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/autenticacao/v1/login',
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO },
    json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token (estoque-grupos)');
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

function limparCor(cor) {
  if (!cor) return '-';
  const partes = String(cor).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(cor).trim();
}
function limparNome(produto) {
  if (!produto) return '';
  const partes = String(produto).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(produto).trim();
}

const top10IdSet = new Set(top.map(p => p.id_produto).filter(Boolean));

// 1) Identifica grupos do top 10 a partir das linhas brutas de vendas
const gruposAlvo = new Set();
for (const linha of raw) {
  if (top10IdSet.has(linha.IdProduto)) {
    if (linha.Grupo) gruposAlvo.add(String(linha.Grupo));
  }
}

// 2) Filtra produtos vendidos hoje que pertencem a algum grupo alvo
const produtosPorId = new Map();
for (const linha of raw) {
  if (!gruposAlvo.has(String(linha.Grupo))) continue;
  const id = linha.IdProduto;
  if (!id) continue;
  const cor = limparCor(linha.Cor);
  const tamanho = String(linha.Tamanho ?? '-').trim() || '-';
  const qtdVend = Number(linha.Quantidade || 0);

  let prod = produtosPorId.get(id);
  if (!prod) {
    prod = {
      id_produto: id,
      codigo: String(linha.Referencia || '').trim() || 'SEM-CODIGO',
      produto: limparNome(linha.Produto),
      grupo: limparNome(linha.Grupo),
      grupo_codigo: String(linha.Grupo).split(' - ')[0],
      vendido_hoje: 0,
      vendas: new Map(),
      no_top10: top10IdSet.has(id)
    };
    produtosPorId.set(id, prod);
  }
  prod.vendido_hoje += qtdVend;
  const chave = cor + '|' + tamanho;
  prod.vendas.set(chave, (prod.vendas.get(chave) || 0) + qtdVend);
}

// 3) Para cada produto único, busca estoque atual
const produtos = [];
const linhas = [];
const gruposMap = new Map();

let valorTotalEstoque = 0;
let totalUnidadesEstoque = 0;

for (const prod of produtosPorId.values()) {
  let rawEstoque = [];
  try {
    rawEstoque = await fetchAll.call(this, '/v1/armazenadores/produtos', { IdProduto: prod.id_produto });
  } catch (err) {
    prod.erro = err.message;
  }

  const variMap = new Map();
  let estoqueTotal = 0;
  let valorEstoqueProd = 0;
  for (const e of rawEstoque) {
    const cor = limparCor(e.Cor);
    const tamanho = String(e.Tamanho ?? '-').trim() || '-';
    const qtd = Number(e.QuantidadeReal ?? e.Quantidade ?? 0);
    const valorUnitCusto = Number(e.ValorCusto || 0);
    if (qtd === 0 && !variMap.has(cor + '|' + tamanho)) continue;
    estoqueTotal += qtd;
    valorEstoqueProd += qtd * valorUnitCusto;
    const chave = cor + '|' + tamanho;
    const cur = variMap.get(chave) || { cor, tamanho, estoque: 0, vendido_hoje: 0 };
    cur.estoque += qtd;
    variMap.set(chave, cur);
  }
  for (const [chave, vendas] of prod.vendas.entries()) {
    const [cor, tamanho] = chave.split('|');
    const cur = variMap.get(chave) || { cor, tamanho, estoque: 0, vendido_hoje: 0 };
    cur.vendido_hoje += vendas;
    variMap.set(chave, cur);
  }

  const variacoes = Array.from(variMap.values()).sort((a, b) => b.estoque - a.estoque);

  const produtoOut = {
    id_produto: prod.id_produto,
    codigo: prod.codigo,
    produto: prod.produto,
    grupo: prod.grupo,
    grupo_codigo: prod.grupo_codigo,
    vendido_hoje: prod.vendido_hoje,
    estoque_total: estoqueTotal,
    valor_custo_estoque: Math.round(valorEstoqueProd * 100) / 100,
    no_top10: prod.no_top10,
    variacoes
  };
  produtos.push(produtoOut);
  valorTotalEstoque += valorEstoqueProd;
  totalUnidadesEstoque += estoqueTotal;

  for (const v of variacoes) {
    linhas.push({
      grupo: prod.grupo,
      codigo: prod.codigo,
      produto: prod.produto,
      cor: v.cor,
      tamanho: v.tamanho,
      vendido_hoje: v.vendido_hoje,
      estoque: v.estoque,
      no_top10: prod.no_top10
    });
  }

  let g = gruposMap.get(prod.grupo);
  if (!g) {
    g = { grupo: prod.grupo, grupo_codigo: prod.grupo_codigo, total_produtos: 0, total_vendido_hoje: 0, total_estoque: 0, valor_custo_estoque: 0, produtos: [] };
    gruposMap.set(prod.grupo, g);
  }
  g.total_produtos += 1;
  g.total_vendido_hoje += prod.vendido_hoje;
  g.total_estoque += estoqueTotal;
  g.valor_custo_estoque += valorEstoqueProd;
  g.produtos.push(produtoOut);

  await sleep(250);
}

const grupos = Array.from(gruposMap.values()).map(g => ({
  ...g,
  valor_custo_estoque: Math.round(g.valor_custo_estoque * 100) / 100,
  produtos: g.produtos.sort((a, b) => b.vendido_hoje - a.vendido_hoje)
})).sort((a, b) => b.total_vendido_hoje - a.total_vendido_hoje);

dados.estoque_grupos_top10 = {
  summary: {
    total_grupos: grupos.length,
    total_produtos: produtos.length,
    total_vendido_hoje: produtos.reduce((s, p) => s + p.vendido_hoje, 0),
    total_estoque: totalUnidadesEstoque,
    valor_custo_estoque: Math.round(valorTotalEstoque * 100) / 100
  },
  grupos,
  produtos: produtos.sort((a, b) => b.vendido_hoje - a.vendido_hoje),
  linhas
};

return [{ json: { modulo: 'vendas', dados } }];`;

const API_READ_CODE = `// ===========================================================
// Le static data e devolve o relatorio solicitado
// modulos: resumo | vendas | estoque
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
    top_clientes: [],
    por_representante: []
  };
}

const vendasPeriodo = agregarVendas();

if (modulo === 'resumo') {
  const s = vendasPeriodo?.summary || {};
  return [{ json: {
    success: true,
    atualizadoEm: erp.atualizadoEm || null,
    data: erp.data || null,
    dataExecucao: erp.dataExecucao || null,
    janelaColeta: erp.janelaColeta || 'D-1',
    periodo: vendasPeriodo?.periodo || null,
    receita_total: s.receita_total || 0,
    volume_vendas: s.volume_vendas || 0,
    ticket_medio: s.ticket_medio || 0,
    total_itens: s.total_itens || 0,
    total_skus: s.total_skus || 0,
    receita_pdv: s.receita_pdv || 0,
    receita_b2b: 0
  } }];
}

if (modulo === 'vendas') {
  if (!vendasPeriodo) {
    return [{ json: { success: false, error: 'Vendas ainda nao coletadas', atualizadoEm: erp.atualizadoEm || null } }];
  }
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: erp.data || null, dados: vendasPeriodo } }];
}

if (modulo === 'estoque') {
  const grupos = vendasPeriodo?.estoque_grupos_top10;
  if (!grupos) {
    return [{ json: { success: false, error: 'Estoque dos grupos top 10 ainda nao coletado', atualizadoEm: erp.atualizadoEm || null } }];
  }
  return [{ json: { success: true, atualizadoEm: erp.atualizadoEm || null, data: erp.data || null, dados: grupos } }];
}

return [{ json: { success: false, error: 'Modulo invalido: ' + modulo, modulos: ['resumo', 'vendas', 'estoque'] } }];`;

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

async function main() {
  const { status, body: wf } = await request('GET', `/workflows/${WF_ID}`);
  if (status !== 200) throw new Error(`GET workflow failed: ${status}`);

  const apiRead = wf.nodes.find((n) => String(n.name || '').includes('Ler Dados ERP'));
  if (!apiRead) throw new Error('Nó Ler Dados ERP não encontrado');
  apiRead.parameters.jsCode = API_READ_CODE;

  let gruposNode = wf.nodes.find((n) => n.name === 'Coletar Estoque Grupos Top 10');
  if (!gruposNode) {
    gruposNode = {
      id: 'coletar-estoque-grupos-top10',
      name: 'Coletar Estoque Grupos Top 10',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1680, 380],
      parameters: { jsCode: COLETAR_GRUPOS_CODE },
      notes: 'Estoque atual dos produtos vendidos hoje cujos Grupos cont\xEAm pelo menos um item do top 10.',
    };
    wf.nodes.push(gruposNode);
  } else {
    gruposNode.parameters.jsCode = COLETAR_GRUPOS_CODE;
    gruposNode.position = [1680, 380];
  }

  const salvar = wf.nodes.find((n) => String(n.name || '').includes('Salvar Relatorio'));
  if (salvar) salvar.position = [1920, 380];

  const conns = wf.connections || {};
  conns['Coletar Estoque Top 10'] = {
    main: [[{ node: 'Coletar Estoque Grupos Top 10', type: 'main', index: 0 }]],
  };
  conns['Coletar Estoque Grupos Top 10'] = {
    main: [[{ node: 'Salvar Relatorio', type: 'main', index: 0 }]],
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
  console.log('Workflow atualizado: + Coletar Estoque Grupos Top 10 + API estoque');

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
