/**
 * Atualiza o nó "Transformar Vendas" no workflow ativo do n8n
 * para usar `Referencia` como código (campo real retornado pela Dapic).
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
  const codigo = String(pick(linha, 'Referencia', 'CodigoProduto', 'Codigo', 'Sku', 'SKU', 'IdProduto') ?? '').trim() || 'SEM-CODIGO';
  const nome = String(pick(linha, 'Produto', 'Descricao', 'NomeProduto', 'Nome') ?? 'Produto sem descricao').trim();
  const quantidade = toNum(pick(linha, 'Quantidade', 'Qtd', 'QuantidadeVendida'));
  const valorTotal = toNum(pick(linha, 'ValorLiquido', 'ValorTotal', 'ValorBruto', 'Valor'));
  const valorUnitario = toNum(pick(linha, 'ValorUnitario', 'PrecoUnitario', 'Preco'));
  const idVenda = pick(linha, 'IdVenda', 'Id', 'IdPdv');
  if (idVenda) vendasIds.add(String(idVenda));

  receitaTotal += valorTotal;
  itensTotais += quantidade;

  const chave = codigo + '|' + nome;
  const atual = mapaProdutos.get(chave) || {
    codigo,
    produto: nome,
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
  if (!transformer) throw new Error('Nó Transformar Vendas não encontrado');

  transformer.parameters.jsCode = TRANSFORMER_CODE;

  const allowed = ['executionOrder', 'saveManualExecutions', 'callerPolicy', 'errorWorkflow', 'timezone'];
  const settings = {};
  for (const k of allowed) if (wf.settings?.[k] !== undefined) settings[k] = wf.settings[k];

  const payload = {
    name: wf.name,
    nodes: wf.nodes,
    connections: wf.connections || {},
    settings,
  };

  const put = await request('PUT', `/workflows/${WF_ID}`, payload);
  if (put.status >= 400) {
    console.error('PUT failed', put.status, JSON.stringify(put.body).slice(0, 600));
    process.exit(1);
  }

  console.log('Transformer atualizado com Referencia como codigo. Disparando nova coleta...');

  const trigger = await new Promise((resolve, reject) => {
    https
      .request(
        { hostname: HOST, path: '/webhook/atualizar', method: 'POST' },
        (res) => {
          let raw = '';
          res.on('data', (c) => (raw += c));
          res.on('end', () => resolve({ status: res.statusCode, body: raw }));
        }
      )
      .on('error', reject)
      .end();
  });
  console.log('Trigger /webhook/atualizar:', trigger.status, trigger.body.slice(0, 200));
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
