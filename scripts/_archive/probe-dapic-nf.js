/** Descobre parametros e estrutura de /v1/notasfiscais (Faturamento). */
const fs = require('fs');
const https = require('https');
const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1];
const token = credentials.match(/\*\*TokenIntegracao\*\*\s*\|\s*`([^`]+)`/)?.[1];
const BASE = 'https://api.dapic.app';
function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = https.request(BASE + path, { method, headers: { Accept: 'application/json', ...(data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {}), ...(global.t ? { Authorization: `Bearer ${global.t}` } : {}) } }, (res) => { let r = ''; res.on('data', c => r += c); res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(r) }); } catch { resolve({ status: res.statusCode, body: r }); } }); });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const get = (p, qs = {}) => request('GET', `${p}?${new URLSearchParams(qs)}`);
const iso = d => d.toISOString().slice(0, 10);
const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  const hoje = new Date();
  const ini = iso(addDays(hoje, -30));
  const fim = iso(hoje);

  const tentativas = [
    { DataInicial: ini, DataFinal: fim },
    { DataInicial: ini, DataFinal: fim, Tipo: 1 },
    { DataInicial: ini, DataFinal: fim, Modelo: 55 },
    { DataInicial: ini, DataFinal: fim, FiltrarPor: 1 },
    { DataInicial: ini, DataFinal: fim, Situacao: 1 },
    { DataEmissaoInicial: ini, DataEmissaoFinal: fim },
  ];
  for (const qs of tentativas) {
    const r = await get('/v1/notasfiscais', { ...qs, Pagina: 1, RegistrosPorPagina: 3 });
    console.log(`\nqs=${JSON.stringify(qs)} -> ${r.status}`);
    if (r.status === 200) {
      const total = r.body?.TotalRegistros ?? r.body?.Total ?? (r.body?.Dados?.length);
      console.log('  TotalRegistros:', total, '| TotalPaginas:', r.body?.TotalPaginas);
      const s = r.body?.Dados?.[0];
      if (s) { console.log('  chaves:', Object.keys(s).join(', ')); console.log('  amostra:', JSON.stringify(s).slice(0, 900)); }
      break;
    } else {
      console.log('  msg:', JSON.stringify(r.body).slice(0, 200));
    }
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
