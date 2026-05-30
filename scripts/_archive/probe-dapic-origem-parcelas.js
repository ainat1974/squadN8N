/**
 * Investiga se as parcelas (contas a receber) trazem a ORIGEM:
 * PDV (venda no balcao) vs Faturamento (NF / pedido B2B).
 * Lista todas as chaves de uma parcela e tabula candidatos a "origem".
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

async function fetchAll(path, qs, maxPg = 40) {
  const all = []; let pg = 1, total = 1;
  do { const r = await get(path, { ...qs, Pagina: pg, RegistrosPorPagina: 200 }); if (Array.isArray(r.body?.Dados)) all.push(...r.body.Dados); total = Math.min(Number(r.body?.TotalPaginas || 1), maxPg); pg++; } while (pg <= total);
  return all;
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) throw new Error('auth falhou: ' + JSON.stringify(auth.body));

  const hoje = new Date();
  const ini = iso(addDays(hoje, -120));
  const fim = iso(addDays(hoje, 30));

  const parcelas = await fetchAll('/v1/contas/parcelas', { DataInicial: ini, DataFinal: fim, FiltrarPor: 1 }, 40);
  const abertas = parcelas.filter(p => {
    const s = String(p.Status || '').toLowerCase();
    return s !== 'cancelada' && s !== 'perdida' && (s === 'aberta' || Number(p.ValorAberto || 0) > 0);
  });

  console.log('Total parcelas:', parcelas.length, '| abertas:', abertas.length);
  console.log('\n=== TODAS AS CHAVES de uma parcela ABERTA ===');
  if (abertas[0]) console.log(Object.keys(abertas[0]).join(', '));
  console.log('\n=== AMOSTRA (2 abertas, JSON completo) ===');
  console.log(JSON.stringify(abertas.slice(0, 2), null, 2));

  // Campos candidatos a indicar origem PDV vs Faturamento
  const candidatos = ['Origem', 'TipoDocumento', 'Tipo', 'Documento', 'Operacao', 'TipoOperacao', 'Modulo', 'Especie', 'EspecieDocumento', 'FormaPagamento', 'Historico', 'PlanoConta', 'NumeroDocumento', 'IdVenda', 'IdPedido', 'IdNotaFiscal', 'Observacao'];
  console.log('\n=== VALORES DISTINTOS por campo candidato (nas abertas) ===');
  for (const campo of candidatos) {
    const presentes = abertas.filter(p => p[campo] != null && p[campo] !== '');
    if (presentes.length === 0) { console.log(`- ${campo}: (ausente/vazio)`); continue; }
    const distintos = {};
    presentes.forEach(p => { const v = String(p[campo]).slice(0, 40); distintos[v] = (distintos[v] || 0) + 1; });
    const top = Object.entries(distintos).sort((a, b) => b[1] - a[1]).slice(0, 8);
    console.log(`- ${campo}: presente em ${presentes.length}/${abertas.length} | ` + top.map(([v, n]) => `"${v}"(${n})`).join(', '));
  }
})().catch(e => { console.error(e.message || e); process.exit(1); });
