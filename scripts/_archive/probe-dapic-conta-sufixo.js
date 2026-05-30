/** Verifica se o codigo "Conta" das parcelas codifica a origem (sufixo de letras). */
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
async function fetchAll(path, qs, maxPg = 50) {
  const all = []; let pg = 1, total = 1;
  do { const r = await get(path, { ...qs, Pagina: pg, RegistrosPorPagina: 200 }); if (Array.isArray(r.body?.Dados)) all.push(...r.body.Dados); total = Math.min(Number(r.body?.TotalPaginas || 1), maxPg); pg++; } while (pg <= total);
  return all;
}
(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  const hoje = new Date();
  const parcelas = await fetchAll('/v1/contas/parcelas', { DataInicial: iso(addDays(hoje, -90)), DataFinal: iso(hoje), FiltrarPor: 1 }, 50);
  // sufixo de letras no fim do codigo Conta
  const sufixo = {};
  const sufixoPorFP = {};
  parcelas.forEach(p => {
    const m = String(p.Conta || '').match(/([A-Za-z]+)$/);
    const suf = m ? m[1] : '(nenhum)';
    sufixo[suf] = (sufixo[suf] || 0) + 1;
    const key = suf + ' | ' + (p.FormaPagamento || '');
    sufixoPorFP[key] = (sufixoPorFP[key] || 0) + 1;
  });
  console.log('=== Sufixo de letras do codigo Conta (todas) ===');
  Object.entries(sufixo).sort((a, b) => b[1] - a[1]).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  console.log('\n=== Sufixo x FormaPagamento (top 15) ===');
  Object.entries(sufixoPorFP).sort((a, b) => b[1] - a[1]).slice(0, 15).forEach(([k, v]) => console.log(`  ${k}: ${v}`));
  // somente abertas
  const abertas = parcelas.filter(p => { const s = String(p.Status || '').toLowerCase(); return s !== 'cancelada' && s !== 'perdida' && (s === 'aberta' || Number(p.ValorAberto || 0) > 0); });
  const sufAb = {};
  abertas.forEach(p => { const m = String(p.Conta || '').match(/([A-Za-z]+)$/); const suf = m ? m[1] : '(nenhum)'; sufAb[suf] = (sufAb[suf] || 0) + 1; });
  console.log('\n=== Sufixo nas ABERTAS ===', JSON.stringify(sufAb));
})().catch(e => { console.error(e.message || e); process.exit(1); });
