/**
 * Analisa o MODELO de /v1/contas/parcelas e /v1/contas/pagamentos:
 * tabula por prefixo de PlanoConta, Status e sinal do valor, para
 * descobrir como separar Contas a Pagar x Receber nesta instancia.
 */
const fs = require('fs');
const https = require('https');

const credentials = fs.readFileSync('squads/n8n-erp-dashboard/_memory/credentials.md', 'utf8');
const empresa = credentials.match(/\*\*Empresa \(Identificador\)\*\*\s*\|\s*`([^`]+)`/)?.[1]
  || credentials.match(/Empresa[^`]*`([^`]+)`/)?.[1];
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
      let raw = ''; res.on('data', c => raw += c);
      res.on('end', () => { try { resolve({ status: res.statusCode, body: JSON.parse(raw) }); } catch { resolve({ status: res.statusCode, body: raw }); } });
    });
    req.on('error', reject); if (data) req.write(data); req.end();
  });
}
const get = (p, qs = {}) => request('GET', `${p}?${new URLSearchParams(qs)}`);
const iso = d => d.toISOString().slice(0, 10);
const addDays = (b, n) => { const d = new Date(b); d.setDate(d.getDate() + n); return d; };

async function fetchAll(path, qs) {
  const all = []; let pg = 1, total = 1;
  do {
    const r = await get(path, { ...qs, Pagina: pg, RegistrosPorPagina: 200 });
    if (Array.isArray(r.body?.Dados)) all.push(...r.body.Dados);
    total = Number(r.body?.TotalPaginas || 1); pg++;
  } while (pg <= total && pg <= 30);
  return all;
}

(async () => {
  const auth = await request('POST', '/autenticacao/v1/login', { Empresa: empresa, TokenIntegracao: token });
  global.t = auth.body?.access_token;
  if (!global.t) throw new Error('auth falhou');

  const hoje = new Date();
  const ini = iso(addDays(hoje, -120));
  const fim = iso(addDays(hoje, 60));

  // FiltrarPor=1 (vencimento) costuma trazer tudo da janela
  const parcelas = await fetchAll('/v1/contas/parcelas', { DataInicial: ini, DataFinal: fim, FiltrarPor: 1 });
  console.log(`\n=== /v1/contas/parcelas (${ini}..${fim}, FiltrarPor=1) total=${parcelas.length} ===`);

  const porPrefixo = {};
  const porStatus = {};
  let somaValor = 0, somaAberto = 0, somaPago = 0;
  let negativos = 0;
  for (const p of parcelas) {
    const pref = String(p.PlanoConta || 'null').split('.')[0];
    porPrefixo[pref] = porPrefixo[pref] || { n: 0, valor: 0, aberto: 0 };
    porPrefixo[pref].n++; porPrefixo[pref].valor += Number(p.Valor || 0); porPrefixo[pref].aberto += Number(p.ValorAberto || 0);
    porStatus[p.Status] = (porStatus[p.Status] || 0) + 1;
    somaValor += Number(p.Valor || 0); somaAberto += Number(p.ValorAberto || 0); somaPago += Number(p.ValorPago || 0);
    if (Number(p.Valor || 0) < 0) negativos++;
  }
  console.log('Por prefixo PlanoConta:', JSON.stringify(porPrefixo, null, 2));
  console.log('Por Status:', JSON.stringify(porStatus));
  console.log('Soma Valor:', somaValor.toFixed(2), '| Aberto:', somaAberto.toFixed(2), '| Pago:', somaPago.toFixed(2), '| valores negativos:', negativos);
  console.log('PlanoContas distintos:', [...new Set(parcelas.map(p => p.PlanoConta))].slice(0, 30));

  // pagamentos
  const pagamentos = await fetchAll('/v1/contas/pagamentos', { DataInicial: iso(addDays(hoje, -30)), DataFinal: iso(hoje) });
  console.log(`\n=== /v1/contas/pagamentos (ult 30d) total=${pagamentos.length} ===`);
  if (pagamentos.length) {
    console.log('keys:', Object.keys(pagamentos[0]).sort());
    console.log('amostra:', JSON.stringify(pagamentos.slice(0, 2), null, 2));
  } else {
    console.log('sem dados de pagamentos no periodo');
  }

  // planoscontas (para classificar)
  const pc = await get('/v1/planoscontas', { Pagina: 1, RegistrosPorPagina: 100 });
  console.log(`\n=== /v1/planoscontas status=${pc.status} ===`);
  const arr = pc.body?.Dados || [];
  console.log('total:', arr.length);
  console.log(JSON.stringify(arr.slice(0, 20).map(x => ({ Codigo: x.Codigo ?? x.codigo, Descricao: x.Descricao ?? x.descricao ?? x.Nome, Tipo: x.Tipo ?? x.tipo ?? x.Natureza })), null, 2));
})().catch(e => { console.error(e.message || e); process.exit(1); });
