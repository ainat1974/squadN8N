/**
 * Adiciona ao workflow:
 *  - Transformer com `id_produto` preservado nos top 10
 *  - Novo nó "Coletar Estoque Top 10" (consulta /v1/armazenadores/produtos por IdProduto)
 *  - API "Ler Dados ERP" devolve `dados.estoque_top10` no payload de vendas
 */
const fs = require('fs');
const https = require('https');

const config = JSON.parse(fs.readFileSync('.mcp.json', 'utf8'));
const API_KEY = config.mcpServers?.['n8n-mcp']?.env?.N8N_API_KEY;
const HOST = 'workflows.tmrodrigues.tech';
const WF_ID = process.argv[2] || '5vEtPrd4vzjCBK9w';

const TRANSFORMER_CODE = `// ===========================================================
// Transforma a lista bruta em relatorio agrupado por produto
// ===========================================================
const { produtosVendidos, dataColeta } = $('Coletar Vendas PDV').first().json;
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
let receitaTotal = 0;
let itensTotais = 0;
const vendasIds = new Set();

for (const linha of produtosVendidos) {
  const codigo = String(pick(linha, 'Referencia', 'CodigoProduto', 'Codigo', 'Sku', 'SKU') ?? '').trim() || 'SEM-CODIGO';
  const nome = String(pick(linha, 'Produto', 'Descricao', 'NomeProduto', 'Nome') ?? 'Produto sem descricao').trim();
  const idProduto = pick(linha, 'IdProduto', 'IdProdutoBase');
  const quantidade = toNum(pick(linha, 'Quantidade', 'Qtd', 'QuantidadeVendida'));
  const valorTotal = toNum(pick(linha, 'ValorLiquido', 'ValorTotal', 'ValorBruto', 'Valor'));
  const valorUnitario = toNum(pick(linha, 'ValorUnitario', 'PrecoUnitario', 'Preco'));
  const idVenda = pick(linha, 'IdVenda', 'Id', 'IdPdv');
  if (idVenda) vendasIds.add(String(idVenda));

  receitaTotal += valorTotal;
  itensTotais += quantidade;

  const chave = (idProduto || codigo) + '|' + nome;
  const atual = mapaProdutos.get(chave) || {
    codigo,
    produto: nome,
    id_produto: idProduto || null,
    quantidade: 0,
    valor_total: 0,
    valor_unitario_medio: 0,
    ocorrencias: 0
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
}

const produtos = Array.from(mapaProdutos.values())
  .map(p => ({
    codigo: p.codigo,
    produto: p.produto,
    id_produto: p.id_produto,
    quantidade: round(p.quantidade),
    valor_unitario_medio: round(p.valor_unitario_medio || (p.quantidade > 0 ? p.valor_total / p.quantidade : 0)),
    valor_total: round(p.valor_total)
  }))
  .sort((a, b) => b.quantidade - a.quantidade);

const volumeVendas = vendasIds.size || produtosVendidos.length;
const ticketMedio = volumeVendas > 0 ? receitaTotal / volumeVendas : 0;

const relatorio = {
  gerado_em: new Date().toISOString(),
  janela: ctx.janelaColeta || 'D-1',
  data: dataColeta,
  periodo: { inicio: dataColeta, fim: dataColeta, tipo: ctx.janelaColeta || 'D-1' },
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
  evolucao_diaria: [{ data: dataColeta, receita: round(receitaTotal), volume: volumeVendas }],
  top_clientes: [],
  por_representante: []
};

return [{ json: { modulo: 'vendas', dados: relatorio } }];`;

const ESTOQUE_TOP10_CODE = `// ===========================================================
// Para cada um dos 10 produtos mais vendidos, consulta o estoque
// (/v1/armazenadores/produtos?IdProduto=X) e devolve a lista de
// variacoes (cor + tamanho) com a quantidade real disponivel.
// ===========================================================
const item = $input.first().json;
const dados = item.dados || {};
const top = (dados.top_produtos || []).slice(0, 10);
const ctx = $('Preparar Contexto').first().json;
const baseUrl = ctx.baseUrl || 'https://api.dapic.com.br';
let token = ctx.token;

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function refreshToken() {
  const auth = await this.helpers.httpRequest({
    method: 'POST',
    url: baseUrl + '/autenticacao/v1/login',
    body: { Empresa: $vars.DAPIC_EMPRESA, TokenIntegracao: $vars.DAPIC_TOKEN_INTEGRACAO },
    json: true
  });
  if (!auth.access_token) throw new Error('Falha ao renovar token (estoque)');
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

function limparNome(produto) {
  if (!produto) return '';
  const partes = String(produto).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(produto).trim();
}

function limparCor(cor) {
  if (!cor) return '-';
  const partes = String(cor).split(' - ');
  return partes.length > 1 ? partes.slice(1).join(' - ').trim() : String(cor).trim();
}

const estoquePorProduto = [];
const linhasEstoque = [];

for (const produto of top) {
  if (!produto.id_produto) {
    estoquePorProduto.push({ codigo: produto.codigo, produto: produto.produto, total: 0, variacoes: [], erro: 'sem id_produto' });
    continue;
  }

  let raw = [];
  try {
    raw = await fetchAll.call(this, '/v1/armazenadores/produtos', { IdProduto: produto.id_produto });
  } catch (err) {
    estoquePorProduto.push({ codigo: produto.codigo, produto: produto.produto, total: 0, variacoes: [], erro: err.message });
    continue;
  }

  const mapaVariacoes = new Map();
  let total = 0;
  for (const linha of raw) {
    const cor = limparCor(linha.Cor);
    const tamanho = String(linha.Tamanho ?? '-').trim() || '-';
    const qtd = Number(linha.QuantidadeReal ?? linha.Quantidade ?? 0);
    if (qtd === 0 && !mapaVariacoes.has(cor + '|' + tamanho)) continue;
    total += qtd;
    const chave = cor + '|' + tamanho;
    const atual = mapaVariacoes.get(chave) || { cor, tamanho, quantidade: 0 };
    atual.quantidade += qtd;
    mapaVariacoes.set(chave, atual);
  }

  const variacoes = Array.from(mapaVariacoes.values()).sort((a, b) => b.quantidade - a.quantidade);
  estoquePorProduto.push({
    codigo: produto.codigo,
    produto: produto.produto,
    id_produto: produto.id_produto,
    total,
    variacoes
  });

  for (const v of variacoes) {
    linhasEstoque.push({
      codigo: produto.codigo,
      produto: produto.produto,
      cor: v.cor,
      tamanho: v.tamanho,
      quantidade: v.quantidade
    });
  }

  await sleep(250);
}

dados.estoque_top10 = estoquePorProduto;
dados.estoque_top10_linhas = linhasEstoque;

return [{ json: { modulo: 'vendas', dados } }];`;

const SALVAR_CODE = `// ===========================================================
// Persiste o relatorio (com estoque dos top 10) no static data
// ===========================================================
const staticData = $getWorkflowStaticData('global');
if (!staticData.erp) staticData.erp = { historico: { diario: {} } };
if (!staticData.erp.historico) staticData.erp.historico = { diario: {} };
if (!staticData.erp.historico.diario) staticData.erp.historico.diario = {};

const item = $input.first().json;
const { dados } = item;
const ctx = $('Preparar Contexto').first().json;
const dataColeta = ctx.dataColeta;

staticData.erp.vendas = dados;
staticData.erp.data = dataColeta;
staticData.erp.dataExecucao = ctx.dataHoje;
staticData.erp.janelaColeta = ctx.janelaColeta || 'D-1';
staticData.erp.atualizadoEm = new Date().toISOString();

if (!staticData.erp.historico.diario[dataColeta]) staticData.erp.historico.diario[dataColeta] = { data: dataColeta };
staticData.erp.historico.diario[dataColeta].vendas = dados;
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
  total_skus: (dados.produtos_vendidos || []).length,
  estoque_top10_linhas: (dados.estoque_top10_linhas || []).length
} }];`;

const API_READ_CODE = `// ===========================================================
// Le static data e devolve o relatorio solicitado (vendas/resumo)
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

return [{ json: { success: false, error: 'Modulo invalido: ' + modulo, modulos: ['resumo', 'vendas'] } }];`;

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

  const transformer = wf.nodes.find((n) => String(n.name || '').includes('Transformar Vendas'));
  const salvar = wf.nodes.find((n) => String(n.name || '').includes('Salvar Relatorio'));
  const apiRead = wf.nodes.find((n) => String(n.name || '').includes('Ler Dados ERP'));

  if (!transformer || !salvar || !apiRead) throw new Error('Nós obrigatórios não encontrados');

  transformer.parameters.jsCode = TRANSFORMER_CODE;
  salvar.parameters.jsCode = SALVAR_CODE;
  apiRead.parameters.jsCode = API_READ_CODE;

  let estoqueNode = wf.nodes.find((n) => n.name === 'Coletar Estoque Top 10');
  if (!estoqueNode) {
    estoqueNode = {
      id: 'coletar-estoque-top10',
      name: 'Coletar Estoque Top 10',
      type: 'n8n-nodes-base.code',
      typeVersion: 2,
      position: [1560, 380],
      parameters: { jsCode: ESTOQUE_TOP10_CODE },
      notes: 'Para cada top 10 produto, busca estoque por IdProduto e agrega cor+tamanho.',
    };
    wf.nodes.push(estoqueNode);
  } else {
    estoqueNode.parameters.jsCode = ESTOQUE_TOP10_CODE;
  }

  if (salvar.position) salvar.position = [1800, 380];

  const conns = wf.connections || {};
  conns['Transformar Vendas'] = {
    main: [[{ node: 'Coletar Estoque Top 10', type: 'main', index: 0 }]],
  };
  conns['Coletar Estoque Top 10'] = {
    main: [[{ node: 'Salvar Relatorio', type: 'main', index: 0 }]],
  };

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const k of allowed) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: conns,
    settings,
  };

  const put = await request('PUT', `/workflows/${WF_ID}`, payload);
  if (put.status >= 400) {
    console.error('PUT failed', put.status, JSON.stringify(put.body).slice(0, 600));
    process.exit(1);
  }
  console.log('Workflow atualizado: estoque_top10 + transformer + salvar + api_read');

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
