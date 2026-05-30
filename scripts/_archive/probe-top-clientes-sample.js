// Coleta amostra real de /v1/vendaspdv (cabecalho) e agrega por cliente,
// para servir de mock-preview do card "Top 10 clientes" na Visao Geral.
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1];
const token = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1];

const BASE = 'https://api.dapic.com.br';
const PAGINAS_AMOSTRA = 8; // amostra de ~1600 cabecalhos

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

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) { console.error('Sem token'); process.exit(1); }

  const hoje = new Date();
  const ini = iso(addDays(hoje, -7));
  const fim = iso(hoje);
  console.log(`Periodo: ${ini} a ${fim}`);

  const mapa = new Map();
  let totalLinhas = 0;
  for (let pagina = 1; pagina <= PAGINAS_AMOSTRA; pagina++) {
    const r = await get('/v1/vendaspdv', { DataInicial: ini, DataFinal: fim, Pagina: pagina, RegistrosPorPagina: 200 });
    if (r.status !== 200 || !Array.isArray(r.body?.Dados)) break;
    for (const v of r.body.Dados) {
      const c = String(v.Cliente || '').trim();
      if (!c) continue;
      const valor = Number(v.ValorLiquido || 0) || 0;
      if (valor <= 0) continue;
      const cur = mapa.get(c) || { cliente: c, valor_total: 0, vendas: 0 };
      cur.valor_total += valor;
      cur.vendas += 1;
      mapa.set(c, cur);
      totalLinhas++;
    }
    if (pagina >= (r.body?.TotalPaginas || 1)) break;
  }

  const top = Array.from(mapa.values())
    .map(x => ({ cliente: x.cliente, valor_total: Math.round(x.valor_total * 100) / 100, vendas: x.vendas }))
    .sort((a, b) => b.valor_total - a.valor_total)
    .slice(0, 10);

  console.log(`\nAmostra: ${totalLinhas} cabecalhos com cliente identificado, ${mapa.size} clientes distintos`);
  console.log('\n=== TOP 10 (amostra real) ===');
  for (let i = 0; i < top.length; i++) {
    console.log(`  ${String(i + 1).padStart(2)}. ${top[i].cliente} | R$ ${top[i].valor_total.toFixed(2)} | ${top[i].vendas} vendas`);
  }

  console.log('\n--- JSON para colar no mock ---');
  console.log(JSON.stringify(top, null, 2));
})().catch(e => { console.error(e.message || e); process.exit(1); });
