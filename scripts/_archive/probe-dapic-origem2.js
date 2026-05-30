/**
 * Aprofunda a origem PDV vs Faturamento:
 * 1) Distribuicao de FormaPagamento e presenca de boleto em TODAS as parcelas.
 * 2) Estrutura do titulo /v1/contas (parent de IdConta) buscando origem/IdVenda/IdNotaFiscal.
 * 3) Testa endpoints candidatos de vendas (PDV) e notas fiscais (faturamento).
 */
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1];
const token = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1];

const BASE = 'https://api.dapic.app';
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
    }, (res) => { let r = ''; res.on('data', c => r += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(r) }); } catch { resolve({ status: res.statusCode, body: r }); } }); });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const get = (p, qs = {}) => request('GET', `${p}?${new URLSearchParams(qs)}`);
const iso = d => d.toISOString().slice(0, 10);
const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };

async function fetchAll(path, qs, maxPg = 50) {
  const all = []; let pg = 1, total = 1;
  do { const r = await get(path, { ...qs, Pagina: pg, RegistrosPorPagina: 200 }); if (Array.isArray(r.body?.Dados)) all.push(...r.body.Dados); total = Math.min(Number(r.body?.TotalPaginas || 1), maxPg); pg++; } while (pg <= total);
  return all;
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) throw new Error('auth falhou');

  const hoje = new Date();
  const ini = iso(addDays(hoje, -90));
  const fim = iso(hoje);

  // 1) Distribuicao de FormaPagamento em todas as parcelas + boleto
  const parcelas = await fetchAll('/v1/contas/parcelas', { DataInicial: ini, DataFinal: fim, FiltrarPor: 1 }, 50);
  const dist = {};
  let comBoleto = 0;
  const contaPrefix = {};
  parcelas.forEach(p => {
    const fp = p.FormaPagamento || '(sem)';
    dist[fp] = (dist[fp] || 0) + 1;
    if (p.NossoNumeroBoleto) comBoleto++;
    const pref = String(p.Conta || '').slice(0, 1);
    contaPrefix[pref] = (contaPrefix[pref] || 0) + 1;
  });
  console.log('=== FormaPagamento (todas as parcelas 90d) ===');
  Object.entries(dist).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('  parcelas com NossoNumeroBoleto:', comBoleto, '/', parcelas.length);
  console.log('  prefixo do codigo Conta:', JSON.stringify(contaPrefix));

  // 2) Titulo /v1/contas (parent). Testa alguns IdConta.
  const idConta = parcelas[0]?.IdConta;
  console.log('\n=== /v1/contas (titulo) ===');
  for (const variante of [
    ['/v1/contas', { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 3 }],
    ['/v1/contas/' + idConta, {}],
  ]) {
    const r = await get(variante[0], variante[1]);
    const sample = Array.isArray(r.body?.Dados) ? r.body.Dados[0] : r.body;
    console.log(`GET ${variante[0]} -> ${r.status} | chaves: ${sample && typeof sample === 'object' ? Object.keys(sample).join(', ') : JSON.stringify(sample).slice(0, 120)}`);
    if (sample && typeof sample === 'object') console.log('   amostra:', JSON.stringify(sample).slice(0, 600));
  }

  // 3) Endpoints candidatos de origem
  console.log('\n=== Endpoints candidatos (status + 1a chave) ===');
  const cands = [
    ['/v1/vendas', { DataInicial: fim, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 2 }],
    ['/v1/pedidos', { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 2 }],
    ['/v1/notasfiscais', { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 2 }],
    ['/v1/notas-fiscais', { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 2 }],
    ['/v1/faturamento', { DataInicial: ini, DataFinal: fim, Pagina: 1, RegistrosPorPagina: 2 }],
  ];
  for (const [path, qs] of cands) {
    try {
      const r = await get(path, qs);
      const sample = Array.isArray(r.body?.Dados) ? r.body.Dados[0] : r.body;
      const keys = sample && typeof sample === 'object' ? Object.keys(sample).join(', ') : String(JSON.stringify(sample)).slice(0, 100);
      console.log(`GET ${path} -> ${r.status} | ${keys.slice(0, 200)}`);
    } catch (e) { console.log(`GET ${path} -> ERRO ${e.message}`); }
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
