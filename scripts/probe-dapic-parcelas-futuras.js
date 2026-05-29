/**
 * Descobre se existem parcelas EM ABERTO com vencimento FUTURO.
 * Testa janelas amplas e FiltrarPor 0/1/2 para entender o modelo.
 */
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/Empresa[^`]*`([^`]+)`/)?.[1];
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

async function fetchAll(path, qs, maxPg = 40) {
  const all = []; let pg = 1, total = 1;
  do { const r = await get(path, { ...qs, Pagina: pg, RegistrosPorPagina: 200 }); if (Array.isArray(r.body?.Dados)) all.push(...r.body.Dados); total = Math.min(Number(r.body?.TotalPaginas || 1), maxPg); pg++; } while (pg <= total);
  return all;
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) throw new Error('auth falhou');

  const hoje = new Date();
  const hojeIso = iso(hoje);

  const janelas = [
    ['futuro-30d', iso(hoje), iso(addDays(hoje, 30))],
    ['futuro-15d', iso(hoje), iso(addDays(hoje, 15))],
    ['passado+futuro-30/30', iso(addDays(hoje, -30)), iso(addDays(hoje, 30))],
    ['passado-90/hoje', iso(addDays(hoje, -90)), hojeIso],
  ];

  for (const fp of [1]) {
    for (const [nome, ini, fim] of janelas) {
      const parcelas = await fetchAll('/v1/contas/parcelas', { DataInicial: ini, DataFinal: fim, FiltrarPor: fp });
      const abertas = parcelas.filter(p => {
        const s = String(p.Status || '').toLowerCase();
        return s !== 'cancelada' && s !== 'perdida' && (s === 'aberta' || Number(p.ValorAberto || 0) > 0);
      });
      const futurasAbertas = abertas.filter(p => String(p.DataVencimento || '').slice(0, 10) > hojeIso);
      const somaFut = futurasAbertas.reduce((s, p) => s + Number(p.ValorAberto || p.ValorFinal || p.Valor || 0), 0);
      const statuses = {};
      parcelas.forEach(p => { statuses[p.Status] = (statuses[p.Status] || 0) + 1; });
      console.log(`\n=== FiltrarPor=${fp} | ${nome} (${ini}..${fim}) ===`);
      console.log('total:', parcelas.length, '| abertas:', abertas.length, '| ABERTAS venc futuro:', futurasAbertas.length, '| R$ futuro aberto:', somaFut.toFixed(2));
      console.log('status:', JSON.stringify(statuses));
      if (futurasAbertas.length) {
        console.log('amostra futura:', JSON.stringify(futurasAbertas.slice(0, 3).map(p => ({ Venc: p.DataVencimento, Status: p.Status, Valor: p.Valor, Aberto: p.ValorAberto, Pessoa: (p.Pessoa || '').trim() })), null, 2));
      }
    }
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
