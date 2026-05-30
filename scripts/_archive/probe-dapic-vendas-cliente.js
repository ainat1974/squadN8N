// Investiga endpoints do Dapic para descobrir QUAL retorna a venda com
// cliente identificado (Pessoa/Cliente). Hoje o /v1/vendaspdv/produtos
// agrega tudo em "Consumidor (sem cadastro)".
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1];
const token = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1];

const BASE = 'https://api.dapic.com.br';

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(BASE + path, {
      method,
      headers: {
        Accept: 'application/json',
        ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}),
        ...(global.t ? { Authorization: `Bearer ${global.t}` } : {}),
      },
    }, (res) => {
      let r = ''; res.on('data', c => r += c); res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(r) }); }
        catch { resolve({ status: res.statusCode, body: r }); }
      });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const get = (p, qs = {}) => request('GET', `${p}?${new URLSearchParams(qs)}`);
const iso = d => d.toISOString().slice(0, 10);
const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };

const PESSOA_KEYS = ['Pessoa', 'IdPessoa', 'NomePessoa', 'Cliente', 'IdCliente', 'NomeCliente'];

function descreveAmostra(arr, fonte) {
  console.log(`  amostras: ${arr.length}`);
  const keys = arr[0] ? Object.keys(arr[0]) : [];
  console.log(`  chaves(${fonte}): ${keys.join(', ')}`);
  const presentes = PESSOA_KEYS.filter(k => keys.includes(k));
  console.log(`  Campos de cliente encontrados: ${presentes.length ? presentes.join(', ') : '(nenhum direto)'}`);
  let comCliente = 0, semCliente = 0;
  for (const r of arr) {
    const v = PESSOA_KEYS.map(k => r[k]).find(v => v != null && String(v).trim() !== '');
    if (v) comCliente++; else semCliente++;
  }
  console.log(`  Linhas com cliente identificado: ${comCliente} / sem: ${semCliente}`);
  if (arr[0]) {
    const sample = {};
    for (const k of ['IdVenda', 'Id', 'IdPdv', 'Numero', 'NumeroVenda', ...PESSOA_KEYS, 'ValorTotal', 'ValorLiquido', 'DataVenda', 'DataEmissao']) {
      if (arr[0][k] !== undefined) sample[k] = arr[0][k];
    }
    console.log('  exemplo (filtrado):', JSON.stringify(sample));
  }
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) { console.error('Sem token. auth=', auth); process.exit(1); }
  console.log('Auth OK\n');

  const hoje = new Date();
  const ini = iso(addDays(hoje, -7));
  const fim = iso(hoje);
  console.log(`Periodo: ${ini} a ${fim}\n`);

  const enderecos = [
    '/v1/vendaspdv',
    '/v1/vendaspdv/cabecalho',
    '/v1/vendaspdv/cabecalhos',
    '/v1/vendas',
    '/v1/vendas/cabecalho',
    '/v1/movimentacoes',
    '/v1/pedidos',
    '/v1/pedidos/cabecalho',
  ];

  for (const ep of enderecos) {
    process.stdout.write(`\n=== ${ep}\n`);
    const r = await get(ep, { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 5 });
    console.log(`  status: ${r.status}`);
    if (r.status === 200 && r.body) {
      console.log(`  TotalRegistros: ${r.body.TotalRegistros ?? '(n/d)'} | TotalPaginas: ${r.body.TotalPaginas ?? '(n/d)'}`);
      const arr = Array.isArray(r.body.Dados) ? r.body.Dados : (Array.isArray(r.body) ? r.body : []);
      if (arr.length) descreveAmostra(arr, ep);
      else console.log('  body (curto):', JSON.stringify(r.body).slice(0, 240));
    } else {
      console.log('  msg:', typeof r.body === 'string' ? r.body.slice(0, 200) : JSON.stringify(r.body).slice(0, 200));
    }
  }

  // bonus: reanaliza /v1/vendaspdv/produtos para confirmar
  console.log('\n=== /v1/vendaspdv/produtos (atual)');
  const r = await get('/v1/vendaspdv/produtos', { DataInicial: ini, DataFinal: fim, FiltrarPor: 0, Status: 1, Pagina: 1, RegistrosPorPagina: 5 });
  console.log('  status:', r.status, '| TotalRegistros:', r.body?.TotalRegistros);
  if (r.body?.Dados?.length) descreveAmostra(r.body.Dados, '/v1/vendaspdv/produtos');
})().catch(e => { console.error(e.message || e); process.exit(1); });
